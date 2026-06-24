---
"@proofkit/webviewer": minor
"@proofkit/fmdapi": minor
---

Add opt-in WebViewerAdapter batching with per-request `batch: true`/`batch: false` controls.
`listAll` and `findAll` now page through bounded `read` requests in the adapter, batching follow-up pages when enabled, and older FileMaker add-on scripts fall back to unbatched requests with a warning that links to batching docs.
