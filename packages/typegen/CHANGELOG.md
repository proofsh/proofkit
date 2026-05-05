# @proofkit/typegen

## 1.1.0

### Minor Changes

- c0c386e: New command: `npx @proofkit/typegen@latest ui` launches a web UI for configuring and running your typegen config. Adds support for `@proofkit/fmodata` typegen configs.
- b73b0d7: Add FM MCP adapter support for type generation (rebranded from FM HTTP). The adapter, config fields, and all references now use `fm-mcp` / `FmMcp` to reflect the FileMaker MCP server branding. Includes a new optional `fmMcp` config for using an FM MCP proxy during metadata fetching, local FM MCP metadata fetch flow, env name handling, and improved adapter error parsing.
- 7dbfd63: Add optional `postGenerateCommand` config option to run a custom formatter after typegen completes. Specify any CLI command (e.g., `pnpm biome format --write` or `npx prettier --write`) and the generated output paths are appended as arguments. Configurable in the typegen UI under Global Settings. The command runs once after all configs (not per config).
- 2f0f8f3: Add Claris ID auth support for `fmodata` FileMaker Cloud connections, including CLI and typegen env/config support.

### Patch Changes

- c85574f: Lazy-load `@proofkit/fmdapi` and `@proofkit/fmodata` inside `@proofkit/typegen` so fmdapi-only and fmodata-only setups do not hard-require the other package at runtime. Both remain regular dependencies (not optional peers) to avoid `ERR_MODULE_NOT_FOUND` when running typegen via `npx`.
- 2df365d: Export `buildSchema` from the root `@proofkit/typegen` entrypoint so consumers can call it directly without importing internal package paths.
- 6da0c9a: Widen OData client error typing to include message and details payloads from env/config validation.
- 4e048d1: Preserve existing field-level customizations during fmodata type regeneration even when `clearOldFiles` is enabled. Stale files are still removed after regeneration without discarding validator customizations.
- f3980b1: Update agent skill content: add warnings to prevent manually adding fields or inventing entity IDs in generated schema files, and deduplicate common mistakes across skills with cross-refs to typegen-setup.
- 3b55d14: Web UI improvements:
  - Fix 431 "Request Header Fields Too Large" errors by omitting cookies from API requests and converting the `list-tables` endpoint from GET to POST.
  - Add a retry button to the error state, highlight matching text in table search, and allow closing all accordions.
  - Fix overflow in the metadata fields dialog where the bottom settings form overlapped with the data grid.

- 23639ec: Fix generated client authentication type detection to use OttoAdapter when `OTTO_API_KEY` is set with default names.
- 4928637: Fix odata generated client validators: correct boolean transformations on `Edm.Boolean` fields, stop duplicating `readValidator`/`writeValidator` for those fields on regeneration, and preserve inline validator helpers in generated odata files.
- 7b46a23: Fix typegen client index generation when multiple fmdapi configs write to the same output path.
- c031d74: Improve `parseMetadata` error messages: when the OData metadata response is missing `<edmx:Edmx>`, surface a response excerpt and recognize common failure modes (empty body, JSON error payload, HTML login redirect) instead of throwing the opaque "No Edmx element found in XML".
- Updated dependencies 
  - @proofkit/fmodata@0.1.0
  - @proofkit/fmdapi@5.1.0

## 1.1.0-beta.27

### Patch Changes

- Updated dependencies [ee4c951]
  - @proofkit/fmodata@0.1.0-beta.42

## 1.1.0-beta.26

### Patch Changes

- 7c7f70a: swap docs domain to proofkit.proof.sh
- Updated dependencies [7c7f70a]
- Updated dependencies [e229b35]
  - @proofkit/fmdapi@5.1.0-beta.5
  - @proofkit/fmodata@0.1.0-beta.41

## 1.1.0-beta.25

### Patch Changes

- c031d74: Improve `parseMetadata` error messages: when the OData metadata response is missing `<edmx:Edmx>`, surface a response excerpt and recognize common failure modes (empty body, JSON error payload, HTML login redirect) instead of throwing the opaque "No Edmx element found in XML".
- Updated dependencies [638f432]
  - @proofkit/fmodata@0.1.0-beta.40

## 1.1.0-beta.24

### Minor Changes

- 2f0f8f3: Add Claris ID auth support for `fmodata` FileMaker Cloud connections, including CLI and typegen env/config support.

### Patch Changes

- Updated dependencies [2f0f8f3]
- Updated dependencies [3d8cd82]
- Updated dependencies [7906ee8]
- Updated dependencies [c0ab6fd]
- Updated dependencies [ac7c9f4]
  - @proofkit/fmodata@0.1.0-beta.39

## 1.1.0-beta.23

### Patch Changes

- Updated dependencies [b075656]
  - @proofkit/fmodata@0.1.0-beta.38

## 1.1.0-beta.22

### Patch Changes

- 0643ddd: Move @proofkit/fmdapi and @proofkit/fmodata from optional peerDependencies to regular dependencies, fixing ERR_MODULE_NOT_FOUND when running typegen via npx
- e6889d0: Update skill content
- Updated dependencies [e6889d0]
  - @proofkit/fmodata@0.1.0-beta.37
  - @proofkit/fmdapi@5.1.0-beta.4

## 1.1.0-beta.21

### Patch Changes

- c85574f: Make `@proofkit/fmdapi` and `@proofkit/fmodata` optional peers for `@proofkit/typegen`, and lazy-load each path so fmdapi-only and fmodata-only installs do not hard-require the other package.
- 6da0c9a: Widen OData client error typing to include message and details payloads from env/config validation.

## 1.1.0-beta.20

### Patch Changes

- 7b46a23: Fix typegen client index generation when multiple fmdapi configs write to the same output path
- 88242c2: fix(typegen): preserve inline validator helpers in generated odata files
- Updated dependencies [e0a9443]
  - @proofkit/fmodata@0.1.0-beta.36

## 1.1.0-beta.19

### Minor Changes

- b73b0d7: - cli: Revamp the Web Viewer Vite template and harden `proofkit init` (ignore hidden files, improve non-interactive prompts, stop generating Cursor rules).
  - cli: Install typegen skills locally when scaffolding projects.
  - typegen: Add optional `fmMcp` config for using an FM MCP proxy during metadata fetching.
  - fmdapi/fmodata/webviewer: Add initial Codex skills for client and integration workflows.
- b73b0d7: Rebrand FM HTTP → FM MCP across the stack. The adapter, config fields, and all references now use `fm-mcp` / `FmMcp` naming to reflect the FileMaker MCP server branding.

### Patch Changes

- Updated dependencies [b73b0d7]
- Updated dependencies [b73b0d7]
  - @proofkit/fmdapi@5.1.0-beta.3
  - @proofkit/fmodata@0.1.0-beta.35

## 1.1.0-beta.18

### Patch Changes

- Updated dependencies [ce73357]
  - @proofkit/fmodata@0.1.0-beta.34

## 1.1.0-beta.17

### Minor Changes

- 5544f68: - cli: Revamp the Web Viewer Vite template and harden `proofkit init` (ignore hidden files, improve non-interactive prompts, stop generating Cursor rules).
  - cli: Install typegen skills locally when scaffolding projects.
  - typegen: Add optional `fmHttp` config for using an FM HTTP proxy during metadata fetching.
  - fmdapi/fmodata/webviewer: Add initial Codex skills for client and integration workflows.
- 1d4b69d: Add FM HTTP adapter support for type generation, including local FM HTTP metadata fetch flow, env name handling, and improved adapter error parsing.

### Patch Changes

- f3980b1: Add warnings to agent skills to prevent manually adding fields or inventing entity IDs in generated schema files; deduplicate common mistakes across skills with cross-refs to typegen-setup
- 8ca7a1e: Fix overflow in metadata fields dialog where bottom settings form overlapped with data grid
- Updated dependencies [5544f68]
- Updated dependencies [f3980b1]
- Updated dependencies [1d4b69d]
  - @proofkit/fmdapi@5.1.0-beta.2
  - @proofkit/fmodata@0.1.0-beta.33

## 1.1.0-beta.16

### Patch Changes

- 2df365d: Export `buildSchema` from the root `@proofkit/typegen` entrypoint so consumers can call it directly without importing internal package paths.
- Updated dependencies [78a9f70]
- Updated dependencies [de21bbe]
- Updated dependencies [1acca57]
  - @proofkit/fmodata@0.1.0-beta.32

## 1.1.0-beta.15

### Patch Changes

- Updated dependencies [2cddedf]
- Updated dependencies [c5efdbd]
  - @proofkit/fmodata@0.1.0-beta.31

## 1.1.0-beta.14

### Patch Changes

- 4e048d1: Fix fmodata type generation to preserve existing field-level customizations even when `clearOldFiles` is enabled.

  Stale files in the output directory are now removed after regeneration, so dead generated files are still cleaned up without discarding validator customizations from existing schemas.

## 1.1.0-beta.13

### Patch Changes

- 4928637: Fix typegen duplicating readValidator/writeValidator on Edm.Boolean fields during regeneration
- Updated dependencies
  - @proofkit/fmodata@0.1.0-beta.29

## 1.1.0-beta.12

### Patch Changes

- Updated dependencies [6c6b569]
  - @proofkit/fmodata@0.1.0-beta.28

## 1.1.0-beta.11

### Patch Changes

- Updated dependencies [840c7c1]
  - @proofkit/fmodata@0.1.0-beta.27

## 1.1.0-beta.10

### Patch Changes

- Updated dependencies [553d386]
  - @proofkit/fmodata@0.1.0-beta.26

## 1.1.0-beta.9

### Patch Changes

- eb7d751: Fix list-tables endpoint 431 error by converting from GET to POST
- Updated dependencies [69fd3fb]
  - @proofkit/fmodata@0.1.0-beta.25

## 1.1.0-beta.8

### Patch Changes

- Updated dependencies [b727425]
  - @proofkit/fmodata@0.1.0-beta.24

## 1.1.0-beta.7

### Patch Changes

- 3b55d14: Web UI improvements: fix 431 error by omitting cookies from API requests; add retry button to error state; highlight matching text in table search; allow closing all accordions

## 1.1.0-beta.6

### Patch Changes

- UI updates

## 1.1.0-beta.5

### Patch Changes

- ae07372: Fix post-generate command to run once after all configs instead of once per config.
- 23639ec: Fix generated client authentication type detection to use OttoAdapter when OTTO_API_KEY environment variable is set with default names
- dfe52a7: Fix boolean transformations in odata

## 1.1.0-beta.4

### Minor Changes

- 7dbfd63: Add optional `postGenerateCommand` config option to run custom formatter after typegen completes. Users can now specify their own CLI command (e.g., `pnpm biome format --write` or `npx prettier --write`) to format generated files. The output paths are automatically appended as arguments to the command. This setting can be configured in the typegen UI's Global Settings section.

### Patch Changes

- 863e1e8: Update tooling to Biome
- Updated dependencies [863e1e8]
  - @proofkit/fmodata@0.1.0-beta.23
  - @proofkit/fmdapi@5.0.3-beta.1

## 1.1.0-beta.3

### Patch Changes

- Updated dependencies [4072415]
  - @proofkit/fmodata@0.1.0-beta.22

## 1.1.0-beta.2

### Minor Changes

- 7672233: New command: `npx @proofkit/typegen@latest ui` will launch a web UI for configuring and running your typegen config.
  (beta) support for @proofkit/fmodata typegen config.

### Patch Changes

- Updated dependencies
  - @proofkit/fmodata@0.1.0-beta.21

## 1.0.11-beta.1

### Patch Changes

- 4d9d0e9: Add type import to the `InferZodPortals` import

## 1.0.11-beta.0

### Patch Changes

- Updated dependencies [78cbab1]
  - @proofkit/fmdapi@5.0.3-beta.0

## 1.0.10

### Patch Changes

- 7c602a9: Export layoutName from generated schema files so consumers can import the layout name when generateClient is false. This avoids hard-coding layout strings elsewhere. No changes to generated clients.
- Updated dependencies [a29ca94]
  - @proofkit/fmdapi@5.0.2

## 1.0.9

### Patch Changes

- 2ff4cd1: Update how portal validation should be passed to the fmdapi client.
  To update, simply re-run the `npx @proofkit/typegen@latest` command and your files will be updated to the correct syntax. If you still see errors, try with the "--reset-overrides" flag to also re-create your overrides files.
- Updated dependencies [2ff4cd1]
  - @proofkit/fmdapi@5.0.1

## 1.0.8

### Patch Changes

- 56270f6: Fix strict numbers to use coerce

## 1.0.7

### Patch Changes

- Update README and package metadata

## 1.0.6

### Patch Changes

- Reduce error logs
- error trap around formatting
- Remove shared-utils dep

## 1.0.1

### Patch Changes

- b483d67: Update formatting after typegen to be more consistent

## 1.0.0

### Major Changes

- 16fb8bd: Introducing @proofkit/typegen

### Minor Changes

- 16fb8bd: Add CLI option to reset the overrides files

### Patch Changes

- 16fb8bd: export type for typegen config
- 16fb8bd: Fix client gen for no validator and no portals
- 16fb8bd: Better success/error messages when layouts aren't found
- 16fb8bd: Proper jsonc parsing
- Updated dependencies [16fb8bd]
- Updated dependencies [16fb8bd]
- Updated dependencies [16fb8bd]
  - @proofkit/fmdapi@5.0.0

## 1.0.0-beta.4

### Patch Changes

- Fix client gen for no validator and no portals

## 1.0.0-beta.3

### Minor Changes

- Add CLI option to reset the overrides files

## 1.0.0-beta.2

### Patch Changes

- export type for typegen config

## 1.0.0-beta.1

### Patch Changes

- 8eb5ad9: Better success/error messages when layouts aren't found
- 6ce4abe: Proper jsonc parsing

## 1.0.0-beta.0

### Major Changes

- f8df018: Introducing @proofkit/typegen

### Patch Changes

- Updated dependencies [c01bed2]
- Updated dependencies [c01bed2]
- Updated dependencies [c01bed2]
  - @proofkit/fmdapi@5.0.0-beta.0
