# @proofgeist/kit

## 2.0.0

### Major Changes

- d3c7979: Rewrite the CLI package for better observability, composability, and error tracing.
- d315ad9: Learn more about v2 in the docs: [https://proofkit.com/docs/cli/v2](https://proofkit.com/docs/cli/v2)

  CLI now defaults to shadcn/ui for new projects. Legacy Mantine templates are still available via a hidden `--ui mantine` flag during `init`. The selected UI is persisted in `proofkit.json` as `ui`. Existing projects using Mantine may not be fully supported.

  For adding new pages or auth via `proofkit add`, you will need to pass the name of the component you want to add, such as `proofkit add table/basic`. See new templates in the [docs](/docs/templates).

### Minor Changes

- b73b0d7: - cli: Revamp the Web Viewer Vite template and harden `proofkit init` (ignore hidden files, improve non-interactive prompts, stop generating Cursor rules).
  - cli: Install typegen skills locally when scaffolding projects.
  - typegen: Add optional `fmMcp` config for using an FM MCP proxy during metadata fetching.
  - fmdapi/fmodata/webviewer: Add initial Codex skills for client and integration workflows.
- b73b0d7: Rebrand FM HTTP → FM MCP across the stack. The adapter, config fields, and all references now use `fm-mcp` / `FmMcp` naming to reflect the FileMaker MCP server branding.

### Patch Changes

- 5bc5504: Init(webviewer): if local FM MCP reports exactly 1 connected file, persist it to `proofkit-typegen.config.jsonc` as `fmMcp.connectedFileName` during scaffold.
- c71b0d4: Add utils/fmdapi to registry
- 7c7f70a: swap docs domain to proofkit.proof.sh
- ee4c951: Clarify local FileMaker setup prompts for the ProofKit plugin flow.
- 41c07ba: Auto-detect non-interactive terminals for CLI commands in CI, scripted runs, and coding-agent environments.
- 1096f3b: Improve `proofkit init` error handling by using tagged Effect-based CLI errors for expected failures, unifying user cancellation, and rendering cleaner top-level error output.
- 03294e5: Init now writes `CLAUDE.md` as `@AGENTS.md` and adds `.cursorignore` to keep `CLAUDE.md` out of Cursor scans.
- bacdb7d: Make initial git commit failures non-blocking during CLI init.
- 8818805: Fix `proofkit add addon` so it works outside an existing ProofKit project.
- c79f183: Fix FileMaker webviewer init flow to install local addon files before prompting that no FileMaker file is open in the local MCP server.
- 63d309b: Fix browser FileMaker scaffolds to install `@proofkit/typegen` and run the local `typegen` bin during initial codegen.
- 4f40bfe: Normalize and validate `.`-derived CLI project names from the current directory consistently, including whitespace-to-dash conversion and lowercasing
- db11fda: Normalize only the final path segment in `parseNameAndPath`, preserving leading directory segments verbatim while keeping scoped-name parsing and `.` handling intact
- d8fba3f: Normalize non-interactive FileMaker layout names against live layout casing so hosted init and release smoke tests do not fail on case-only layout drift.
- e3b25c3: Refocus the ProofKit CLI around project bootstrap and diagnostics by adding `doctor` and placeholder `prompt` commands, updating default guidance and docs, and switching scaffolded typegen scripts to package-native `@proofkit/typegen` commands.
- 863e1e8: Update tooling to Biome
- e6d0c55: Improve local ProofKit MCP setup messaging during webviewer init by reporting the connected FileMaker file after retry and prompting to choose a file when multiple files are open.
- fe43be6: Drop the unused `nextjs-mantine` scaffold from the current CLI and always scaffold browser apps from `nextjs-shadcn`.
- 46696e4: Require `proofkit init` to use an explicit local FileMaker file selection in non-interactive multi-file setups, and save the selected local file into the generated typegen config.
- d5ca0e5: Preserve typed cancellation errors in the default project menu and wrap add/remove menu failures with stable error messages.
- 9add5ca: Remove the `--ui` init flag. ProofKit now only scaffolds shadcn.
- ee4c951: Restore the interactive project menu when running `proofkit` inside an existing ProofKit project.
- 9add5ca: Allow spaces in project names by normalizing them to dashes
- 18ade4d: Limit `proofkit add` to supported ProofKit add-ons and remove the unused registry-backed install path.
- 9add5ca: Clarify that `.` uses the current directory for `proofkit init`
- be34116: Make scaffolded Web Viewer upload scripts use `deploy_html` as the canonical FileMaker script, with bridge-first and FMP URL fallback deployment.
- 9efea04: Fix version warning
- d7f86a4: Update newly scaffolded apps to use Ultracite for linting and formatting by default, including the generated `lint` and `format` scripts and CLI formatting flow.
- e0ea042: updated addon to fix a bug in the SendCallback script
- Updated dependencies [7dbfd63]
- Updated dependencies [ae07372]
- Updated dependencies [7c7f70a]
- Updated dependencies [c85574f]
- Updated dependencies [b73b0d7]
- Updated dependencies [2f0f8f3]
- Updated dependencies [2df365d]
- Updated dependencies [6da0c9a]
- Updated dependencies [4e048d1]
- Updated dependencies [f3980b1]
- Updated dependencies [3b55d14]
- Updated dependencies [23639ec]
- Updated dependencies [4928637]
- Updated dependencies [8ca7a1e]
- Updated dependencies [7b46a23]
- Updated dependencies [0643ddd]
- Updated dependencies [b73b0d7]
- Updated dependencies [b73b0d7]
- Updated dependencies [863e1e8]
- Updated dependencies [c031d74]
- Updated dependencies [eb7d751]
- Updated dependencies [dfe52a7]
- Updated dependencies [e216e07]
- Updated dependencies [4d9d0e9]
- Updated dependencies [e6889d0]
- Updated dependencies [c0c386e]
- Updated dependencies [88242c2]
- Updated dependencies [78cbab1]
  - @proofkit/typegen@1.1.0
  - @proofkit/fmdapi@5.1.0

## 2.0.0-beta.34

### Patch Changes

- bacdb7d: Make initial git commit failures non-blocking during CLI init.

## 2.0.0-beta.33

### Patch Changes

- ee4c951: Clarify local FileMaker setup prompts for the ProofKit plugin flow.
- d5ca0e5: Preserve typed cancellation errors in the default project menu and wrap add/remove menu failures with stable error messages.
- ee4c951: Restore the interactive project menu when running `proofkit` inside an existing ProofKit project.
- be34116: Make scaffolded Web Viewer upload scripts use `deploy_html` as the canonical FileMaker script, with bridge-first and FMP URL fallback deployment.
  - @proofkit/typegen@1.1.0-beta.27

## 2.0.0-beta.32

### Patch Changes

- 7c7f70a: swap docs domain to proofkit.proof.sh
- 18ade4d: Limit `proofkit add` to supported ProofKit add-ons and remove the unused registry-backed install path.
- Updated dependencies [7c7f70a]
  - @proofkit/fmdapi@5.1.0-beta.5
  - @proofkit/typegen@1.1.0-beta.26

## 2.0.0-beta.31

### Patch Changes

- Updated dependencies [c031d74]
  - @proofkit/typegen@1.1.0-beta.25

## 2.0.0-beta.30

### Patch Changes

- 63d309b: Fix browser FileMaker scaffolds to install `@proofkit/typegen` and run the local `typegen` bin during initial codegen.
- d8fba3f: Normalize non-interactive FileMaker layout names against live layout casing so hosted init and release smoke tests do not fail on case-only layout drift.
- Updated dependencies [2f0f8f3]
  - @proofkit/typegen@1.1.0-beta.24

## 2.0.0-beta.29

### Patch Changes

- c79f183: Fix FileMaker webviewer init flow to install local addon files before prompting that no FileMaker file is open in the local MCP server.
  - @proofkit/typegen@1.1.0-beta.23

## 2.0.0-beta.28

### Patch Changes

- 8818805: Fix `proofkit add addon` so it works outside an existing ProofKit project.
- e0ea042: updated addon to fix a bug in the SendCallback script
- Updated dependencies [0643ddd]
- Updated dependencies [e6889d0]
  - @proofkit/typegen@1.1.0-beta.22
  - @proofkit/fmdapi@5.1.0-beta.4

## 2.0.0-beta.27

### Patch Changes

- 5bc5504: Init(webviewer): if local FM MCP reports exactly 1 connected file, persist it to `proofkit-typegen.config.jsonc` as `fmMcp.connectedFileName` during scaffold.
- 03294e5: Init now writes `CLAUDE.md` as `@AGENTS.md` and adds `.cursorignore` to keep `CLAUDE.md` out of Cursor scans.
- 4f40bfe: Normalize and validate `.`-derived CLI project names from the current directory consistently, including whitespace-to-dash conversion and lowercasing
- db11fda: Normalize only the final path segment in `parseNameAndPath`, preserving leading directory segments verbatim while keeping scoped-name parsing and `.` handling intact
- fe43be6: Drop the unused `nextjs-mantine` scaffold from the current CLI and always scaffold browser apps from `nextjs-shadcn`.
- 9add5ca: Remove the `--ui` init flag. ProofKit now only scaffolds shadcn.
- 9add5ca: Allow spaces in project names by normalizing them to dashes
- 9add5ca: Clarify that `.` uses the current directory for `proofkit init`
- Updated dependencies [c85574f]
- Updated dependencies [6da0c9a]
  - @proofkit/typegen@1.1.0-beta.21

## 2.0.0-beta.26

### Patch Changes

- e3b25c3: Refocus the ProofKit CLI around project bootstrap and diagnostics by adding `doctor` and placeholder `prompt` commands, updating default guidance and docs, and switching scaffolded typegen scripts to package-native `@proofkit/typegen` commands.

## 2.0.0-beta.25

### Patch Changes

- 41c07ba: Auto-detect non-interactive terminals for CLI commands in CI, scripted runs, and coding-agent environments.
- 1096f3b: Improve `proofkit init` error handling by using tagged Effect-based CLI errors for expected failures, unifying user cancellation, and rendering cleaner top-level error output.
- e6d0c55: Improve local ProofKit MCP setup messaging during webviewer init by reporting the connected FileMaker file after retry and prompting to choose a file when multiple files are open.
- 46696e4: Require `proofkit init` to use an explicit local FileMaker file selection in non-interactive multi-file setups, and save the selected local file into the generated typegen config.
- Updated dependencies [7b46a23]
- Updated dependencies [88242c2]
  - @proofkit/typegen@1.1.0-beta.20

## 2.0.0-beta.23

### Minor Changes

- b73b0d7: - cli: Revamp the Web Viewer Vite template and harden `proofkit init` (ignore hidden files, improve non-interactive prompts, stop generating Cursor rules).
  - cli: Install typegen skills locally when scaffolding projects.
  - typegen: Add optional `fmMcp` config for using an FM MCP proxy during metadata fetching.
  - fmdapi/fmodata/webviewer: Add initial Codex skills for client and integration workflows.
- b73b0d7: Rebrand FM HTTP → FM MCP across the stack. The adapter, config fields, and all references now use `fm-mcp` / `FmMcp` naming to reflect the FileMaker MCP server branding.

### Patch Changes

- Updated dependencies [b73b0d7]
- Updated dependencies [b73b0d7]
  - @proofkit/typegen@1.1.0-beta.19
  - @proofkit/fmdapi@5.1.0-beta.3

## 2.0.0-beta.1

### Major Changes

- d3c7979: Rewrite the CLI package for better observability, composability, and error tracing.

### Patch Changes

- d7f86a4: Update newly scaffolded apps to use Ultracite for linting and formatting by default, including the generated `lint` and `format` scripts and CLI formatting flow.
  - @proofkit/typegen@1.1.0-beta.18

## 2.0.0-beta.22

### Minor Changes

- 5544f68: - cli: Revamp the Web Viewer Vite template and harden `proofkit init` (ignore hidden files, improve non-interactive prompts, stop generating Cursor rules).
  - cli: Install typegen skills locally when scaffolding projects.
  - typegen: Add optional `fmHttp` config for using an FM HTTP proxy during metadata fetching.
  - fmdapi/fmodata/webviewer: Add initial Codex skills for client and integration workflows.

### Patch Changes

- Updated dependencies [5544f68]
- Updated dependencies [f3980b1]
- Updated dependencies [8ca7a1e]
- Updated dependencies [1d4b69d]
  - @proofkit/typegen@1.1.0-beta.17
  - @proofkit/fmdapi@5.1.0-beta.2

## 2.0.0-beta.21

### Patch Changes

- Updated dependencies [2df365d]
  - @proofkit/typegen@1.1.0-beta.16

## 2.0.0-beta.20

### Patch Changes

- @proofkit/typegen@1.1.0-beta.15

## 2.0.0-beta.19

### Patch Changes

- Updated dependencies [4e048d1]
  - @proofkit/typegen@1.1.0-beta.14

## 2.0.0-beta.18

### Patch Changes

- Updated dependencies [4928637]
  - @proofkit/typegen@1.1.0-beta.13

## 2.0.0-beta.17

### Patch Changes

- @proofkit/typegen@1.1.0-beta.12

## 2.0.0-beta.16

### Patch Changes

- @proofkit/typegen@1.1.0-beta.11

## 2.0.0-beta.15

### Patch Changes

- @proofkit/typegen@1.1.0-beta.10

## 2.0.0-beta.14

### Patch Changes

- Updated dependencies [eb7d751]
  - @proofkit/typegen@1.1.0-beta.9

## 2.0.0-beta.13

### Patch Changes

- @proofkit/typegen@1.1.0-beta.8

## 2.0.0-beta.12

### Patch Changes

- Updated dependencies [3b55d14]
  - @proofkit/typegen@1.1.0-beta.7

## 2.0.0-beta.11

### Patch Changes

- Updated dependencies
  - @proofkit/typegen@1.1.0-beta.6

## 2.0.0-beta.10

### Patch Changes

- Updated dependencies [ae07372]
- Updated dependencies [23639ec]
- Updated dependencies [dfe52a7]
  - @proofkit/typegen@1.1.0-beta.5

## 2.0.0-beta.9

### Patch Changes

- 863e1e8: Update tooling to Biome
- Updated dependencies [7dbfd63]
- Updated dependencies [863e1e8]
  - @proofkit/typegen@1.1.0-beta.4
  - @proofkit/fmdapi@5.0.3-beta.1

## 2.0.0-beta.8

### Patch Changes

- @proofkit/typegen@1.1.0-beta.3

## 2.0.0-beta.4

### Patch Changes

- Updated dependencies [4d9d0e9]
  - @proofkit/typegen@1.0.11-beta.1

## 1.1.8

### Patch Changes

- 00177bf: Guard page add/remove against missing `src/app/navigation.tsx` so Web Viewer apps don’t error when updating navigation. This safely no-ops when the navigation file isn’t present.
- Updated dependencies [7c602a9]
- Updated dependencies [a29ca94]
  - @proofkit/typegen@1.0.10
  - @proofkit/fmdapi@5.0.2

## 1.1.5

### Patch Changes

- Run typegen code directly instead of via execa
- error trap around formatting
- Remove shared-utils dep

## 1.1.0

### Minor Changes

- 7429a1e: Add simultaneous support for Shadcn. New projects will have Shadcn initialized automatically, and the upgrade command will offer to automatically add support for Shadcn to an existing ProofKit project.

### Patch Changes

- b483d67: Update formatting after typegen to be more consistent
- f0ddde2: Upgrade next-safe-action to v8 (and related dependencies)
- 7c87649: Fix getFieldNamesForSchema function

## 1.0.0

### Major Changes

- c348e37: Support @proofkit namespaced packages

### Patch Changes

- Updated dependencies [16fb8bd]
- Updated dependencies [16fb8bd]
- Updated dependencies [16fb8bd]
  - @proofkit/fmdapi@5.0.0

## 0.3.2

### Patch Changes

- 8986819: Fix: name argument in add command optional
- 47aad62: Make the auth installer spinner good

## 0.3.1

### Patch Changes

- 467d0f9: Add new menu command to expose all proofkit functions more easily
- 6da944a: Ensure using authedActionClient in existing actions after adding auth
- b211fbd: Deploy command: run build on Vercel instead of locally. Use flag --local-build to build locally like before
- 39648a9: Fix: Webviewer addon installation flow
- d0627b2: update base package versions

## 0.3.0

### Minor Changes

- 846ae9a: Add new upgrade command to upgrade ProofKit components in an existing project. To start, this command only adds/updates the cursor rules in your project.

### Patch Changes

- e07341a: Always use accessorFn for tables for better type errors

## 0.2.3

### Patch Changes

- 217eb5b: Fixed infinite table queries for other field names
- 217eb5b: New infinite table editable template

## 0.2.2

### Patch Changes

- ffae753: Better https parsing when prompting for the FileMaker Server URL
- 415be19: Add options for password strength in fm-addon auth. Default to not check for compromised passwords
- af5feba: Fix the launch-fm script for web viewer

## 0.2.1

### Patch Changes

- 6e44193: update helper text for npm after adding page
- 6e44193: additional supression of hydration warning
- 6e44193: move question about adding data source for new project
- 183988b: fix import path for reset password helper
- 6e44193: Make an initial commit when initializing git repo
- e0682aa: Copy cursor rules.mdc file into the base project.

## 0.2.0

### Minor Changes

- 6073cfe: Allow deploying a demo file to your server instead of having to pick an existing file

### Patch Changes

- d0f5c6e: Fix: post-install template functions not running

## 0.1.2

### Patch Changes

- 92cb423: fix: runtime error due to external shared package

## 0.1.1

### Patch Changes

- f88583c: prompt user to login to Vercel if needed during deploy command

## 0.1.0

### Minor Changes

- c019363: Add Deploy command for Vercel

### Patch Changes

- 0b7bf78: Allow setup without any data sources

## 0.0.15

### Patch Changes

- 1ff4aa7: Hide options for unsupported features in webviewer apps
- 5cfd0aa: Add infinite table page template
- 063859a: Added Template: Editable Table
- de0c2ab: update shebang in index
- b7ad0cf: Stream output from the typegen command

## 0.0.6

### Patch Changes

- Adding pages

## 0.0.3

### Patch Changes

- add typegen command for fm

## 0.0.2

### Patch Changes

- fix auth in init

## 0.0.2-beta.0

### Patch Changes

- fix auth in init
