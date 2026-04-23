---
"@proofkit/fmodata": patch
---

Fix `_makeRequestEffect` unconditionally overwriting the caller-supplied `Accept` header. `getMetadata({ format: "xml" })` was setting `Accept: application/xml` which got clobbered with `application/json`, causing the server to return JSON metadata that was then mis-cast to a string and handed to fast-xml-parser. Now the default Accept is only applied when the caller hasn't specified one. This unblocks `@proofkit/typegen` for fmodata configs.
