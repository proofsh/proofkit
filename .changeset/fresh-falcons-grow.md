---
"@proofkit/fmodata": minor
---

Add `ROWID` record locator support to `fmodata` single-record APIs.

- Allow `db.from(table).get({ ROWID: 2 })`
- Add `update(data).byRowId(2)`
- Add `delete().byRowId(2)`
