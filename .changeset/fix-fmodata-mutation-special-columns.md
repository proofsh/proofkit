---
"@proofkit/fmodata": patch
---

Fix `insert()` and `update(..., { returnFullRecord: true })` to preserve merged `Prefer` headers for `fmodata.include-specialcolumns` and `fmodata.entity-ids`, and return special columns in typed full-record mutation responses.
