---
name: webdirect-runtime
description: >
  FileMaker WebDirect ProofKit Web Viewer runtime behavior refresh resilience
  session state localStorage browser resize reload same deployment embedded bundle
  avoid separate deployment avoid separate web server @proofkit/webviewer
  fmFetch callFMScript WebViewerAdapter WebDirect page refresh
type: core
library: proofkit
library_version: "3.0.7"
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
