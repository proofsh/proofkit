---
"@proofkit/webviewer": minor
"@proofkit/fmdapi": minor
---

Add default WebViewerAdapter batching with per-request `batch: true`/`batch: false` controls and a maximum batch size of 20.
`batch: false` now disables request coalescing while still sending single-request batch payloads, falling back to the older direct request path only after an installed FileMaker add-on script reports that batching is unsupported.
`listAll` and `findAll` now page through bounded `read` requests in the adapter, batching follow-up pages when enabled, and older FileMaker add-on scripts fall back to unbatched requests with a warning that links to batching docs.
Docs include tuning guidance for benchmarking batch size, page size, payload size, script execution path, and ProofKit add-on version requirements against real FileMaker layouts and found sets.
