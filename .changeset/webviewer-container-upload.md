---
"@proofkit/webviewer": minor
---

Implement `containerUpload` in `WebViewerAdapter`. Files are Base64-encoded and written by the add-on's `PK_container_upload` FileMaker script, which navigates by record ID with `Go to List of Records` in a new window so the Web Viewer's layout stays current. Adds a `container` adapter option for `scriptName`, `timeoutMs`, and `maxFileBytes`. Requires FileMaker Pro 22.0 or later and an add-on that includes the script. When no script answers in time the call rejects with the new exported `ContainerUploadTimeoutError`, which carries `outcome: "unknown"` because the timeout cannot stop a FileMaker script that may still commit the write. File names without an extension, and container field repetitions above 1, are rejected client-side.
