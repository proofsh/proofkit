---
"@proofkit/typegen": patch
---

Improve `parseMetadata` error messages: when the OData metadata response is missing `<edmx:Edmx>`, surface a response excerpt and recognize common failure modes (empty body, JSON error payload, HTML login redirect) instead of throwing the opaque "No Edmx element found in XML".
