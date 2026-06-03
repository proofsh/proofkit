---
"@proofkit/cli": minor
"@proofkit/typegen": minor
---

Simplify the ProofKit CLI to `init`, `doctor`, and `typegen`.

- Remove the `add`, `remove`, `deploy`, `upgrade`, and `prompt` subcommands and their supporting installers/generators/helpers. The Web Viewer add-on is now downloaded and opened during `proofkit init`.
- `proofkit typegen` is now a thin alias that delegates entirely to `@proofkit/typegen` with no duplicated generation logic. Supports `--config`, `--env-path`, `--proofkit-token`, and `--reset-overrides`.
- Drop the Commander dependency; the CLI is now built entirely on `@effect/cli`.

`@proofkit/typegen` now exposes its CLI runner through a new `@proofkit/typegen/cli` entrypoint (`runCli`).
