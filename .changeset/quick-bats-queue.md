---
"@proofkit/webviewer": minor
"@proofkit/fmdapi": minor
---

Add opt-in WebViewerAdapter batching and adapter-level listAll/findAll pagination hooks.
Batching can be controlled per request with `batch: true` or `batch: false`, and older FileMaker add-on scripts fall back to unbatched requests with a warning that links to batching docs.
