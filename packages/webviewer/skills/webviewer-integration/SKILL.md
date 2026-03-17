---
name: webviewer-integration
description: >
  webviewer fmFetch callFMScript WebViewerAdapter globalSettings setWebViewerName
  SendCallback window.FileMaker browser-only FileMaker WebViewer script execution
  fire-and-forget FMScriptOption PerformScript callback fetchId handleFmWVFetchCallback
type: core
library: proofkit
library_version: "3.0.7-beta.0"
sources:
  - "proofgeist/proofkit:packages/webviewer/src/main.ts"
  - "proofgeist/proofkit:packages/webviewer/src/adapter.ts"
  - "proofgeist/proofkit:apps/docs/content/docs/webviewer/*.mdx"
---

## Setup

Install the package and set the webviewer name before calling any scripts.

```ts
import { fmFetch, globalSettings } from "@proofkit/webviewer";

// Must match the Layout Object Name of the WebViewer in FileMaker
globalSettings.setWebViewerName("web");

// Call a FM script and await the result
const result = await fmFetch("MyScript", { key: "value" });
```

If you also want the local `typegen-setup` skill for generating `@proofkit/fmdapi` clients that work with `WebViewerAdapter`, install:

```bash
pnpm add -D @proofkit/typegen@^1.1.0-beta.0
```

The `setWebViewerName` call is required for `fmFetch` to work. It tells the FM `SendCallback` script which webviewer to call back into. Set it once at app initialization.

## Core Patterns

### fmFetch -- call script, await result

`fmFetch` calls a FileMaker script via `window.FileMaker.PerformScript` and returns a Promise that resolves when the FM script calls `SendCallback` with the matching `fetchId`.

```ts
import { fmFetch } from "@proofkit/webviewer";

// With type parameter (unsafe cast -- validate with zod if needed)
type Customer = { id: string; name: string };
const customer = await fmFetch<Customer>("GetCustomer", { id: "123" });
```

The FM script receives a JSON parameter with two keys:
- `data` -- whatever you passed as the second argument
- `callback` -- object containing `fetchId`, `fn`, and `webViewerName`

The FM script must extract `callback`, attach the result, and call `SendCallback`:

```
Set Variable [ $json ; Get(ScriptParameter) ]
Set Variable [ $callback ; JSONGetElement($json ; "callback") ]
Set Variable [ $data ; JSONGetElement($json ; "data") ]

# ... do work, build $result ...

Set Variable [ $callback ; JSONSetElement($callback ;
  ["result"; $result; JSONObject];
  ["webViewerName"; "web"; JSONString])
]
Perform Script [ "SendCallBack" ; $callback ]
```

### callFMScript -- fire-and-forget

`callFMScript` calls a FileMaker script with no callback. Use when you don't need a return value.

```ts
import { callFMScript, FMScriptOption } from "@proofkit/webviewer";

// Basic call
callFMScript("NavigateToLayout", { layout: "Customers" });

// With script execution option
callFMScript("RunReport", { id: "42" }, FMScriptOption.HALT);
```

`FMScriptOption` values: `CONTINUE` ("0"), `HALT` ("1"), `EXIT` ("2"), `RESUME` ("3"), `PAUSE` ("4"), `SUSPEND_AND_RESUME` ("5").

### WebViewerAdapter -- Data API via local scripts

`WebViewerAdapter` implements the `@proofkit/fmdapi` `Adapter` interface, routing Data API calls through a FM script that uses the `Execute FileMaker Data API` script step. No network auth needed.

```ts
import { DataApi } from "@proofkit/fmdapi";
import { WebViewerAdapter } from "@proofkit/webviewer/adapter";

const client = DataApi({
  adapter: new WebViewerAdapter({ scriptName: "ExecuteDataApi" }),
  layout: "API_Customers",
});

// Now use standard fmdapi methods
const records = await client.list();
const found = await client.findOne({ query: { id: "===1234" } });
```

The adapter supports: `list`, `find`, `get`, `create`, `update`, `delete`, `layoutMetadata`. It does NOT support `executeScript` or `containerUpload` -- these throw.

### FM script callback setup

For `fmFetch` to resolve, the FM side needs two scripts:

1. **Your script** -- receives the parameter, does work, attaches result to callback, calls `SendCallback`
2. **SendCallback** -- provided by the ProofKit addon. Calls `Perform JavaScript in Web Viewer` targeting the webviewer named in the callback, invoking `handleFmWVFetchCallback(result, fetchId)`.

The JS side registers callbacks in a map keyed by UUID (`fetchId`). When `handleFmWVFetchCallback` fires, it looks up and invokes the matching callback, resolving the Promise.

## Common Mistakes

### [CRITICAL] Importing webviewer package in server-side code

Wrong:
```ts
// app/api/route.ts (Next.js API route -- runs on server)
import { fmFetch } from "@proofkit/webviewer";

export async function GET() {
  const data = await fmFetch("GetData", {});
  return Response.json(data);
}
```

Correct:
```ts
// components/DataLoader.tsx (client component -- runs in WebViewer)
"use client";
import { fmFetch } from "@proofkit/webviewer";

export function DataLoader() {
  const load = async () => {
    const data = await fmFetch("GetData", {});
  };
  // ...
}
```

`@proofkit/webviewer` depends on `window.FileMaker`, which is only injected by FileMaker into WebViewer contexts. Importing it in server code or standard browsers will fail at runtime.
Source: `packages/webviewer/src/main.ts` lines 111-115, `apps/docs/content/docs/webviewer/index.mdx`

### [CRITICAL] fmFetch promise never resolves

Wrong:
```
# FM Script -- missing SendCallback call
Set Variable [ $json ; Get(ScriptParameter) ]
Set Variable [ $data ; JSONGetElement($json ; "data") ]
# ... do work ...
Exit Script [ $result ]
```

Correct:
```
# FM Script -- calls SendCallback with matching webViewerName
Set Variable [ $json ; Get(ScriptParameter) ]
Set Variable [ $callback ; JSONGetElement($json ; "callback") ]
Set Variable [ $data ; JSONGetElement($json ; "data") ]
# ... do work, build $result ...
Set Variable [ $callback ; JSONSetElement($callback ;
  ["result"; $result; JSONObject];
  ["webViewerName"; "web"; JSONString])
]
Perform Script [ "SendCallBack" ; $callback ]
```

The FM script must call `SendCallback` with the correct `webViewerName` and the original `fetchId` (embedded in `$callback`). If `SendCallback` is never called, or called with the wrong webviewer name, the JS Promise hangs forever. Also ensure the script does not exit/halt early or navigate away from the layout containing the webviewer.
Source: `apps/docs/content/docs/webviewer/troubleshooting.mdx`, `packages/webviewer/src/main.ts` lines 79-87

### [HIGH] Calling FM scripts before window.FileMaker is available

Wrong:
```ts
// Runs immediately on page load
import { callFMScript } from "@proofkit/webviewer";
callFMScript("Init", {});
```

Correct:
```ts
import { callFMScript } from "@proofkit/webviewer";

// Wait for FileMaker to inject the JS bridge
function waitForFileMaker(): Promise<void> {
  return new Promise((resolve) => {
    if (window.FileMaker) return resolve();
    const interval = setInterval(() => {
      if (window.FileMaker) {
        clearInterval(interval);
        resolve();
      }
    }, 100);
  });
}

await waitForFileMaker();
callFMScript("Init", {});
```

FileMaker injects `window.FileMaker` after the page loads. Calling `callFMScript` or `fmFetch` before it exists throws: `"window.FileMaker was not available at the time this function was called"`.
Source: `packages/webviewer/src/main.ts` lines 111-115, `apps/docs/content/docs/webviewer/troubleshooting.mdx`

### [HIGH] Using executeScript or containerUpload via WebViewerAdapter

Wrong:
```ts
import { DataApi } from "@proofkit/fmdapi";
import { WebViewerAdapter } from "@proofkit/webviewer/adapter";

const client = DataApi({
  adapter: new WebViewerAdapter({ scriptName: "ExecuteDataApi" }),
  layout: "API_Customers",
});

// Throws at runtime
await client.executeScript("SomeScript", "param");
```

Correct:
```ts
import { DataApi } from "@proofkit/fmdapi";
import { WebViewerAdapter } from "@proofkit/webviewer/adapter";
import { fmFetch, callFMScript } from "@proofkit/webviewer";

const client = DataApi({
  adapter: new WebViewerAdapter({ scriptName: "ExecuteDataApi" }),
  layout: "API_Customers",
});

// Use fmdapi client for CRUD operations
const records = await client.list();

// Use webviewer functions for script execution
const result = await fmFetch("SomeScript", { param: "value" });
callFMScript("FireAndForget", {});
```

`WebViewerAdapter.executeScript()` and `WebViewerAdapter.containerUpload()` explicitly throw. Use `fmFetch` or `callFMScript` from `@proofkit/webviewer` to run scripts directly.
Source: `packages/webviewer/src/adapter.ts` lines 133-141

### [CRITICAL] Accessing window.FileMaker directly instead of library functions

Wrong:
```ts
// Bypasses callback tracking, loses type safety
window.FileMaker.PerformScript("MyScript", JSON.stringify({ key: "value" }));
```

Correct:
```ts
import { callFMScript, fmFetch } from "@proofkit/webviewer";

// Fire-and-forget
callFMScript("MyScript", { key: "value" });

// Or with response
const result = await fmFetch("MyScript", { key: "value" });
```

Calling `window.FileMaker.PerformScript` directly bypasses the callback registration system. `fmFetch` won't work because the script parameter won't contain the `callback` object with `fetchId`. The library also handles JSON serialization and the `PerformScriptWithOption` variant automatically.
Source: `packages/webviewer/src/main.ts` lines 79-87, 92-122

### [HIGH] Not accounting for single-threaded FM script execution in WebViewer

Wrong:
```ts
import { DataApi } from "@proofkit/fmdapi";
import { WebViewerAdapter } from "@proofkit/webviewer/adapter";

const customersClient = DataApi({
  adapter: new WebViewerAdapter({ scriptName: "ExecuteDataApi" }),
  layout: "API_Customers",
});
const ordersClient = DataApi({
  adapter: new WebViewerAdapter({ scriptName: "ExecuteDataApi" }),
  layout: "API_Orders",
});

// Concurrent calls -- each waits for the previous to finish via SendCallback
// FileMaker executes scripts sequentially, causing compounding delays
const [customers, orders] = await Promise.all([
  customersClient.list(),
  ordersClient.list(),
]);
```

Correct:
```ts
// Sequential calls -- explicit about execution order
const customers = await customersClient.list();
const orders = await ordersClient.list();
```

In WebViewer local mode, FM scripts execute single-threaded. `Promise.all` with multiple `fmFetch`-based calls does not parallelize -- each script must complete and call back before the next runs. Concurrent calls can queue up and cause UI freezes. Use sequential awaits and minimize the number of round-trips.
Source: `apps/docs/content/docs/webviewer/fmdapi.mdx`, `packages/webviewer/src/main.ts`

## References

- **fmdapi-client**: `WebViewerAdapter` implements the `Adapter` interface from `@proofkit/fmdapi`. CRUD methods (`list`, `find`, `get`, `create`, `update`, `delete`) work identically to the network-based adapter. See the fmdapi-client skill for method signatures and query patterns.
