---
"@proofkit/cli": minor
"@proofkit/typegen": minor
"@proofkit/fmdapi": patch
"@proofkit/fmodata": patch
"@proofkit/webviewer": patch
---

- cli: Revamp the Web Viewer Vite template and harden `proofkit init` (ignore hidden files, improve non-interactive prompts, stop generating Cursor rules).
- cli: Install typegen skills locally when scaffolding projects.
- typegen: Add optional `fmMcp` config for using an FM MCP proxy during metadata fetching.
- fmdapi/fmodata/webviewer: Add initial Codex skills for client and integration workflows.
