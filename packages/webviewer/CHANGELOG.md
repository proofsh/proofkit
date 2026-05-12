# @proofkit/webviewer

## 3.0.8

### Patch Changes

- 2a69c03: Add Next.js fmBridge helper for App Router and Pages Router dev integration.
- f744723: Add WebDirect runtime skill for refresh-safe Web Viewer apps.

## 3.0.7

### Patch Changes

- b73b0d7: Rebrand FM HTTP → FM MCP across the stack to reflect the FileMaker MCP server branding. The adapter, config fields, and all references now use `fm-mcp` / `FmMcp`. Revamps the Web Viewer Vite template and adds initial Codex skills for webviewer integration workflows.
- 5dda815: Soften the Vite FM bridge startup path when FM MCP responds but has no connected files. The dev server now logs a warning, injects a fallback bridge shim, and logs runtime errors if bridge calls are made before a file connects. Unreachable or unhealthy FM MCP still fails setup.
- 8818805: Document the `proofkit add addon webviewer` command in the Web Viewer skill and setup docs.
- f3980b1: Update agent skill content: add warnings to prevent manually adding fields or inventing entity IDs in generated schema files.

## 3.0.7-beta.5

### Patch Changes

- 7c7f70a: swap docs domain to proofkit.proof.sh

## 3.0.7-beta.4

### Patch Changes

- 8818805: Document the `proofkit add addon webviewer` command in the Web Viewer skill and setup docs.
- e6889d0: Update skill content

## 3.0.7-beta.3

### Patch Changes

- 5dda815: Soften the Vite FM bridge startup path when FM MCP responds but has no connected files. The dev server now logs a warning, injects a fallback bridge shim, and logs runtime errors if bridge calls are made before a file connects. Unreachable or unhealthy FM MCP still fails setup.

## 3.0.7-beta.2

### Patch Changes

- b73b0d7: - cli: Revamp the Web Viewer Vite template and harden `proofkit init` (ignore hidden files, improve non-interactive prompts, stop generating Cursor rules).
  - cli: Install typegen skills locally when scaffolding projects.
  - typegen: Add optional `fmMcp` config for using an FM MCP proxy during metadata fetching.
  - fmdapi/fmodata/webviewer: Add initial Codex skills for client and integration workflows.
- b73b0d7: Rebrand FM HTTP → FM MCP across the stack. The adapter, config fields, and all references now use `fm-mcp` / `FmMcp` naming to reflect the FileMaker MCP server branding.

## 3.0.7-beta.1

### Patch Changes

- 5544f68: - cli: Revamp the Web Viewer Vite template and harden `proofkit init` (ignore hidden files, improve non-interactive prompts, stop generating Cursor rules).
  - cli: Install typegen skills locally when scaffolding projects.
  - typegen: Add optional `fmHttp` config for using an FM HTTP proxy during metadata fetching.
  - fmdapi/fmodata/webviewer: Add initial Codex skills for client and integration workflows.

## 3.0.7-beta.0

### Patch Changes

- 863e1e8: Update tooling to Biome

## 3.0.6

### Patch Changes

- b28a070: Added method to support "executeScript" method required by the adapter

## 3.0.5

### Patch Changes

- eb7594a: Fix import paths

## 3.0.2

### Patch Changes

- Update readme and repo metadata

## 3.0.0

### Major Changes

- Rename to @proofkit/webviewer

# @proofgeist/fm-webviewer-fetch

## 2.2.4

### Patch Changes

- fix \_offset \_limit and \_sort params

## 2.2.0

### Minor Changes

- caf1260: Add Webviewer Adapter for @proofgeist/fmdapi v4
