---
name: webdirect-runtime
description: >
  FileMaker WebDirect ProofKit Web Viewer runtime behavior refresh resilience
  session state localStorage browser resize reload same deployment embedded bundle
  avoid separate deployment avoid separate web server @proofkit/webviewer
  fmFetch callFMScript WebViewerAdapter WebDirect page refresh blank app empty body
  character encoding browser network response console errors deployed HTML
metadata:
  type: core
  library: proofkit
  library_version: "3.2.0"
sources:
  - "proofsh/proofkit:apps/docs/content/docs/webviewer/platform-notes.mdx"
  - "proofsh/proofkit:apps/docs/content/docs/webviewer/deployment-methods.mdx"
  - "proofsh/proofkit:apps/docs/content/docs/webviewer/runtime-under-the-hood.mdx"
  - "proofsh/proofkit:packages/webviewer/src/main.ts"
---

## Core Rule

WebDirect does not require separate JavaScript code, a separate build, a separate deployment target, or a separate web server. A ProofKit Web Viewer app runs in the Web Viewer with the same `@proofkit/webviewer` APIs used in FileMaker Pro.

The main WebDirect-specific concern is refresh resilience. WebDirect can refresh the Web Viewer more often than a normal browser app, including from actions like resizing the browser window. Design the app so unexpected page reloads are recoverable.

## Build Guidance

Use the normal ProofKit Web Viewer patterns:

```ts
import { fmFetch, globalSettings } from "@proofkit/webviewer";

globalSettings.setWebViewerName("web");

const result = await fmFetch("GetDashboardState", { recordId: "123" });
```

Deploy the app the same way as any FileMaker Web Viewer app. Embedded bundles stored in the FileMaker file are valid for WebDirect. Do not tell users to host WebDirect apps separately unless they independently chose the hosted deployment method for other reasons.

Don't apply conventional public-site page-weight budgets directly to embedded Web Viewer apps. A 10 MB bundle may be large by conventional website standards, but size alone isn't evidence that WebDirect can't load the app. Treat bundle size as a cause only after reproducing a size-dependent failure or measuring a transfer or startup problem. Check the deployed HTML, runtime errors, FileMaker bridge readiness, and WebDirect refresh behavior first.

## Blank App Troubleshooting

When a web app doesn't load in WebDirect, inspect what the browser received before changing the app or its deployment model.

1. Use connected browser tooling when available. Open the actual WebDirect page in the user's session.
2. Inspect the complete page response served by WebDirect in the browser's network tools. Don't limit the inspection to the Web Viewer HTML stored in FileMaker or a local copy of the app bundle. Confirm whether the full WebDirect page payload contains the deployed Web Viewer HTML and JavaScript. Don't assume which request or internal loading path carries it; identify that from the live browser traffic.
3. Check the browser console for parse errors, runtime exceptions, blocked resources, or security errors.
4. Distinguish an empty WebDirect page response from an empty rendered root element inside the Web Viewer. React can start with an empty root and populate it at runtime, so the DOM alone doesn't prove that WebDirect omitted the bundle.

If the complete page served by WebDirect has an empty body and the Web Viewer bundle is absent from that response, suspect character encoding first. An incorrectly encoded or unsupported character in the deployed single-file HTML can cause WebDirect to return an empty body instead of sending the bundle. Inspect the built HTML for invalid UTF-8 or problematic characters, rebuild, redeploy, and check the full WebDirect response again.

If the full WebDirect response contains the Web Viewer HTML and JavaScript bundle, don't keep treating encoding or bundle size as the default cause. Follow the browser's console and network evidence to the parse, runtime, bridge, or security failure.

## State Pattern

Persist critical client state so a WebDirect-triggered reload is not destructive.

Good candidates for `localStorage`:

- Current workflow step.
- Selected record or layout context.
- Unsaved form draft data.
- UI filters, search terms, and sort state.
- Idempotency keys for in-progress actions.

Keep FileMaker as the source of truth for committed data. Use `localStorage` only for client recovery state, then revalidate or reload FileMaker data after the app starts.

```ts
const STORAGE_KEY = "invoice-review:draft";

export function saveDraft(draft: InvoiceDraft) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
}

export function loadDraft(): InvoiceDraft | null {
  const value = localStorage.getItem(STORAGE_KEY);
  return value ? (JSON.parse(value) as InvoiceDraft) : null;
}
```

On startup, restore local UI state first, then call FileMaker for authoritative context:

```ts
const draft = loadDraft();
const session = await fmFetch("GetWebViewerSession", {
  restoredDraftId: draft?.id,
});
```

## UX Pattern

Prefer explicit save, resume, and discard flows. A WebDirect user should not lose important work because the browser window resized or the Web Viewer refreshed.

For forms and multi-step workflows:

- Save drafts locally while the user types.
- Clear draft state only after FileMaker confirms a successful save.
- Show a "Resume draft?" prompt when restored state exists.
- Make FileMaker script writes idempotent when retries are possible.

For dashboards and list screens:

- Store view state locally.
- Refetch FileMaker data on load.
- Avoid assuming in-memory React/TanStack Query cache survives.

## Common Mistakes

### [CRITICAL] Recommending separate WebDirect deployment

Wrong:

```text
Because this app runs in WebDirect, deploy it to Vercel and point the Web Viewer at the hosted URL.
```

Correct:

```text
Use the same ProofKit Web Viewer deployment. The bundle can live in the FileMaker file for FileMaker Pro, FileMaker Go, and WebDirect.
```

WebDirect changes runtime refresh behavior, not the deployment model.

### [HIGH] Blaming bundle size before inspecting the response

Wrong:

```text
This app is 10 MB, so WebDirect cannot load it. Split the app or host it separately.
```

Correct:

```text
Open the WebDirect page in a browser and inspect the complete page response served by WebDirect, not only the stored Web Viewer HTML or a local app bundle. If the full response body is empty and the Web Viewer bundle is absent, investigate character encoding first. If the full page and bundle arrived, follow the browser errors.
```

Embedded Web Viewers load the app as a single payload. Standard public-site bundle budgets are useful optimization signals, but they don't establish a WebDirect loading limit.

### [HIGH] Keeping critical workflow state only in memory

Wrong:

```ts
const [draft, setDraft] = useState<InvoiceDraft>(emptyDraft);
```

Correct:

```ts
const [draft, setDraft] = useState<InvoiceDraft>(() => loadDraft() ?? emptyDraft);

function updateDraft(next: InvoiceDraft) {
  setDraft(next);
  saveDraft(next);
}
```

React state is lost on Web Viewer refresh. Persist state needed to recover the user flow.

### [HIGH] Treating localStorage as committed FileMaker data

Wrong:

```ts
const invoice = loadDraft();
renderInvoice(invoice);
```

Correct:

```ts
const draft = loadDraft();
const invoice = await fmFetch("GetInvoice", { id: draft?.invoiceId });
renderInvoice({ ...invoice, draft });
```

Use local storage for recovery state. Re-read FileMaker for authoritative data.

### [MEDIUM] Assuming browser refresh is user intent

Wrong:

```ts
window.addEventListener("beforeunload", () => {
  localStorage.removeItem("invoice-review:draft");
});
```

Correct:

```ts
async function save() {
  await fmFetch("SaveInvoiceReview", draft);
  localStorage.removeItem("invoice-review:draft");
}
```

In WebDirect, refresh can be incidental. Clear recovery state only after an explicit successful action.

## Related Skills

- **webviewer-integration**: Use for `fmFetch`, `callFMScript`, `WebViewerAdapter`, callback setup, and script bridge mechanics.
