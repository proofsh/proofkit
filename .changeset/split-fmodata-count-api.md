---
"@proofkit/fmodata": minor
---

Split the fmodata count API into 2 flows. `db.from(table).count()` now runs a count-only query against the `/$count` endpoint, while `db.from(table).list().count()` keeps the list query and returns `{ records, count }` from a single request. This improves pagination ergonomics and avoids forcing two requests when rows and total count are both needed.
