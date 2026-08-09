---
"@proofkit/webviewer": minor
---

Implement `containerUpload` in `WebViewerAdapter`. Files are Base64-encoded and written by the add-on's `PK_container_upload` FileMaker script, which navigates by record ID with `Go to List of Records` in a new window so the Web Viewer's layout stays current. Adds a `container` adapter option for `scriptName`, `timeoutMs`, and `maxFileBytes`. Requires FileMaker Pro 22.0 or later and an add-on that includes the script; older add-ons fail with a timeout that tells you to update. Container field repetitions above 1 are rejected for now.
