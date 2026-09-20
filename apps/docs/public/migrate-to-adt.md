<!-- vale Vale.Spelling = NO -->
<!-- vale Microsoft.HeadingAcronyms = NO -->
<!-- vale Microsoft.Terms = NO -->
<!-- vale Microsoft.GeneralURL = NO -->

# Migrate a ProofKit Web Viewer Project to an ADT Web Viewer App

Convert the ProofKit Vite web viewer in the current Git repository into an ADT project and web viewer app. Preserve a standalone root app in a temporary `proofkit-backup/` staging directory; when the app is already a package inside a monorepo, leave it in place and use that package as the migration source. Then run `adt init` at the repository root and let it discover the FileMaker candidates before selecting or asking about a target. Run `adt connect` before the deep read-only inventory so `adt.json` records the FileMaker target and account name and later commands can reuse Keychain credentials. After inventory and one approval gate, let ADT create `webviewer-apps/<app-name>`, migrate the source application into it, and update application-owned FileMaker scripts in place for ADT's runtime contract. Don't create duplicate wrapper scripts.

Source preparation, `adt init`, and `adt connect` happen before the approval gate; they don't modify FileMaker schema or data. After the authenticated read-only inventory, ask once for backup confirmation and permission to execute the complete migration. Then continue through `adt app add`, app changes, FileMaker script edits, write-flow tests, and browser verification without asking for routine approvals again.

## Inputs

- ProofKit repository: the current working directory
- FileMaker file: let `adt init` discover the candidates; use repository evidence only to disambiguate its results
- ADT file key: optional override; otherwise accept the key ADT derives from the FileMaker filename
- ADT app name: optional override; otherwise derive it from the original `package.json` name

These are discovery outputs, not a form the user must fill out. Never begin by announcing “missing required inputs” or asking for the FileMaker target, file key, and app name as a bundle. Run `adt init` before asking about the FileMaker file and use what it discovers. Ask one narrow question only when its candidates can't be resolved from repository evidence.

## Use the installed ADT instructions

Read these installed files from start to finish before running ADT or `filemaker` commands:

```text
$HOME/Library/Application Support/ADT/MCP/agent-plugin/skills/adt-project-setup/SKILL.md
$HOME/Library/Application Support/ADT/MCP/agent-plugin/skills/adt-webviewer-app/SKILL.md
$HOME/Library/Application Support/ADT/MCP/agent-plugin/skills/fm-cli/SKILL.md
$HOME/Library/Application Support/ADT/MCP/agent-plugin/skills/filemaker-standards/SKILL.md
```

If these installed instructions are missing or unreadable, you can't proceed with the migration. Ask the user to run the latest ADT installer, then stop. Don't inventory missing paths, troubleshoot the installation, or substitute instructions from a cached Codex plugin, another checkout, or memory.

Follow the references those skills require. Resolve the active FileMaker standards before editing scripts.

ADT isn't installed on the shell `PATH` by default. Invoke it through its Application Support path. The FileMaker CLI, now named `filemaker`, is installed on the default user `PATH` and should be invoked by name:

```sh
ADT_BIN="$HOME/Library/Application Support/ADT/MCP/agent-plugin/bin/adt"
if [ ! -x "$ADT_BIN" ] || ! command -v filemaker >/dev/null 2>&1; then
  echo "Run the latest ADT installer before continuing" >&2
  exit 1
fi
"$ADT_BIN" --version
filemaker --version
```

Redeclare `ADT_BIN` in every new shell process that uses it. Don't add ADT to the user's global `PATH`, invoke the internal `fm-cli` and `adt`binaries directly.

## Operating rules

- Work in the current Git repository. Don't create a sibling migration project or a second Git repository.
- Preserve unrelated and pre-existing working-tree changes. Record the initial status and keep the migration diff scoped.
- Before the deep inventory, choose the source mode: stage a standalone root app in `proofkit-backup/`, or leave an existing monorepo package in place. Then initialize ADT and connect the FileMaker file.
- Use `adt init . --no-git` so the existing repository remains authoritative and ADT performs its built-in FileMaker discovery. Then ensure `adt connect` runs explicitly once so the target and account name are recorded before any `filemaker` inventory calls.
- Use `adt app add --no-commit` so the scaffold doesn't commit in the middle of the migration.
- Let ADT create its manifest, app, vendored package, components, and app layout. In an existing monorepo, merge ADT's workspace requirements into the established root files.
- Move or merge application files from the resolved source app into the generated ADT app. Keep the source intact until the migrated app verifies, then remove only files proven obsolete or superseded.
- Update application-owned FileMaker wrappers in place. Preserve their names and FileMaker-side callers. Don't create parallel or suffixed ADT copies.
- Repoint calls to ProofKit add-on scripts to independently verified ADT equivalents. Keep the ProofKit add-on installed until the migrated app passes automated verification and the user verifies it in FileMaker.
- After the user verifies the migrated app, inspect and remove its confirmed ProofKit deployment data from FileMaker persistent data with `filemaker`, then have the user uninstall the ProofKit add-on from the FileMaker file.
- Use `filemaker update:script` step edits addressed by `uuid`, with a current `token` and `expect` checks. Never replace an existing script's whole `body`.
- For every protected-file `filemaker` run, reuse the exact `target` and `username` stored in `adt.json` with `--keychain --prompt`. The prompt is fallback only; repeated password windows are a connection or Keychain problem to resolve before continuing.
- Dry-run every FileMaker write batch, require `"errors":0`, apply it, require `"rolledBack":false`, and verify from a fresh `filemaker` process.
- Clean up every dev server or watcher started during the migration.

Stop only when the target changes, the backup isn't confirmed, credentials or a FileMaker lock require human action, a tool reports an unknown write outcome, a required operation is unsupported, or the migration has reached the required final user-verification and add-on-uninstall checkpoint. A failed check inside the approved migration scope is work to fix, not a reason to ask permission again.

## 1. Inspect the repository and choose the source mode

Start with lightweight repository inspection. Locate the ProofKit app, its package, and the workspace root. Don't try to discover the FileMaker target yourself and don't run the deep FileMaker inventory yet:

```sh
ADT_BIN="$HOME/Library/Application Support/ADT/MCP/agent-plugin/bin/adt"
pwd
git rev-parse --show-toplevel
git status --short
proofkit --version
"$ADT_BIN" --version
uname -s
node -v
pnpm -v
rg --files \
  -g 'proofkit.config.json' -g 'proofkit.json' \
  -g '!node_modules/**' -g '!.git/**'
rg --files --hidden \
  -g 'AGENTS.md' -g 'CLAUDE.md' \
  -g '!node_modules/**' -g '!.git/**'
sed -n '1,260p' package.json
if [ -f pnpm-workspace.yaml ]; then sed -n '1,260p' pnpm-workspace.yaml; fi
if [ -f pnpm-workspace.yml ]; then sed -n '1,260p' pnpm-workspace.yml; fi
```

Select the ProofKit config that belongs to the app being migrated and set its directory as the original source app directory. When both config names exist in that directory, `proofkit.config.json` wins. When several ProofKit apps exist, use repository context to identify the intended one and ask the user to choose only when more than one remains equally plausible. When none exists, stop and ask which file defines the project. Confirm that the selected config has `appType: "webviewer"`; stop with a compatibility report for browser and Next.js projects.

Before moving or generating files, read every root-level and source-app-level `AGENTS.md` and `CLAUDE.md` that governs the ProofKit app. Record each file's scope and preserve its project-specific instructions for the merge in section 2.

Read the selected app's `package.json` name and derive the **suggested** ADT app name:

1. Remove an npm scope. `@acme/inventory-viewer` becomes `inventory-viewer`.
2. Convert the remainder to kebab-case.
3. Use a user-supplied override as the **resolved** name; otherwise use the suggestion.
4. Report the source package name, suggested name, and resolved name separately.

Check collisions using the resolved name. Ask for another name only when the resolved `webviewer-apps/<name>` already exists or the package has no usable name.

Choose one source mode and record `<source-app-dir>` for every later phase:

| Repository shape | Source mode |
|---|---|
| The ProofKit app is the repository-root package and the root isn't already a monorepo workspace | **Standalone:** move the app into `proofkit-backup/`; that directory becomes `<source-app-dir>`. |
| The ProofKit app is already a package in an existing monorepo | **Monorepo:** leave the package where it is; its existing directory is `<source-app-dir>`. |

An existing monorepo is evidenced by its root workspace configuration and the selected app already being one of its packages. A repository isn't a monorepo merely because it has subdirectories or a root `package.json`.

### Standalone source

Create `proofkit-backup/` and move the existing application into it. This produces a clear ADT project root while keeping the original application available as the migration source. This local, reversible staging step doesn't authorize FileMaker writes.

Move all application-owned source and configuration, including when present:

- `package.json` and the package-manager lockfile;
- ProofKit configuration files;
- `src/`, `public/`, tests, and static assets;
- Vite, TypeScript, lint, formatting, test, and build configuration;
- app-specific scripts, generated clients, typegen overrides, and environment examples.
- root `AGENTS.md` and `CLAUDE.md` when they govern the standalone app rather than unrelated repository administration.

The existing `.git/` directory must remain at the repository root throughout the migration. Never move, copy, recreate, or initialize Git metadata inside `proofkit-backup/`. Also don't move `proofkit-backup/` itself or unrelated repository-level documentation and administration files. Preserve the initial `.gitignore` and any repository instructions long enough to merge their still-applicable rules into the ADT project. When ownership is uncertain, leave the file in place and record it for the migration report instead of guessing.

The staging directory must not already exist or contain files. If it does, stop and ask whether it belongs to an earlier migration. Don't merge into or overwrite an existing backup.

Use `git mv` for tracked files and a normal move for untracked application files so local changes are preserved. Move an explicit inventory of paths; don't use a wildcard or filesystem-wide sweep. Then verify:

```sh
cd "<absolute-proofkit-repository-path>"
test -f proofkit-backup/package.json
test ! -f package.json
git status --short
sed -n '1,260p' proofkit-backup/package.json
```

Keep `proofkit-backup/` intact until ADT has created the destination app. During migration, move or merge files out of it only after identifying the ADT-owned destination file that must be preserved. Never delete a staged file merely because ADT generated a file with the same name.

### Monorepo source

Leave the existing package, root `package.json`, lockfile, workspace manifest, shared configuration, and Git metadata in place. The original package is the migration source, so creating `proofkit-backup/` would add an unnecessary duplicate. Record its current workspace membership and run its existing typecheck, tests, and build in place for the baseline.

Initialize ADT at the monorepo root. ADT will create the destination separately at `webviewer-apps/<resolved-adt-app-name>`. Preserve the monorepo's package-manager and workspace conventions; later steps must register the generated app with the existing workspace when ADT's directory isn't already matched.

## 2. Initialize ADT, discover the file, and establish credentials

Initialize ADT at the repository root as soon as the source mode is prepared. Let `adt init` perform FileMaker discovery and connect the first file automatically when exactly one file is open. If `adt.json` already exists, validate that it belongs to this migration instead of recreating it:

```sh
ADT_BIN="$HOME/Library/Application Support/ADT/MCP/agent-plugin/bin/adt"
cd "<absolute-proofkit-repository-path>"
if [ ! -f adt.json ]; then
  "$ADT_BIN" init . --no-git
fi
sed -n '1,260p' adt.json
"$ADT_BIN" standards
```

### Merge existing agent instructions

`adt init` preserves any root `AGENTS.md` or `CLAUDE.md` that already exists. When it reports that it kept one, its ADT project instructions weren't written to that file. Read the current installed template as the missing source:

```sh
ADT_PROJECT_AGENTS="$HOME/Library/Application Support/ADT/MCP/template/project/AGENTS.md"
test -r "$ADT_PROJECT_AGENTS"
sed -n '1,320p' "$ADT_PROJECT_AGENTS"
```

Merge instructions according to their scope:

1. Keep every applicable project-specific rule from the original root `AGENTS.md` and `CLAUDE.md`.
2. Merge the ADT project instructions into the root `AGENTS.md`, whether they came from the file generated by init or the installed template above. Reconcile duplicates instead of concatenating two complete documents.
3. Prefer the merged root `AGENTS.md` as the single source of truth. If the original `CLAUDE.md` has unique rules, merge them into `AGENTS.md`, then make `CLAUDE.md` point to it with `@AGENTS.md`. Preserve another established import convention only when both agents still reach the complete merged instructions.
4. Keep source-app-only rules scoped to `<source-app-dir>` for the app-level merge in section 7. Don't promote package-specific commands or conventions to the repository root.
5. If two applicable rules directly conflict and repository context doesn't resolve them, show the exact conflict and ask one narrow question. Otherwise complete the merge without another approval.

Re-read the merged files and inspect `git diff` to verify that no original or ADT rule disappeared and that the files contain no circular imports.

Read the merged root `AGENTS.md` and every standards file reported by `adt standards` before continuing.

Treat the `adt init` output and `adt.json` as the authoritative discovery result:

| Init result | Action |
|---|---|
| One file was connected automatically | Read its exact key and target from `adt.json`, then explicitly reconnect that target once to establish credentials and Agent Access. |
| Several candidates were reported | Correlate those exact candidates with the source ProofKit config, package name, scripts, environment examples, and repository name. Run the exact `adt connect` command emitted by init when one clearly matches; otherwise ask the user to choose only from those candidates. |
| No candidate was reported | Follow init's next step. If it says nothing is open, ask the user to open the intended file or enable Agent Access, then rerun ADT discovery before requesting a path or URL. |
| An existing `adt.json` already names the intended file | Validate it, then explicitly reconnect its exact target once. |

Don't separately scan the filesystem, query FileMaker's Agent Access endpoint, or run `adt connect --suggest` before `adt init`. Those duplicate ADT's discovery and can make the agent ask questions before ADT has supplied its candidates.

Ensure `adt connect` runs explicitly once before any authenticated `filemaker` inventory. When init connected a file automatically, reconnect the exact manifest target while preserving its key:

```sh
ADT_BIN="$HOME/Library/Application Support/ADT/MCP/agent-plugin/bin/adt"
cd "<absolute-proofkit-repository-path>"
"$ADT_BIN" connect "<exact target from adt.json>" --name "<existing file key>"
# Or run the exact adt connect command emitted by init when it needed a selection.
```

Don't ask for a FileMaker username or password in chat. `adt connect` is the credential entry point: tell the user to watch for its native credential window and FileMaker's Agent Access prompt, then wait for them to complete those prompts. Allow ADT to save the credential in Keychain.

Read `adt.json` after connecting. Record its actual file key, exact `target`, and `username`. A protected file isn't ready for inventory until `adt.json` contains the account name used by the successful connection. If it is absent, rerun `adt connect` for that exact target and finish the native prompt; absence is acceptable only when the connection confirms that the file is unprotected. Outside the reconnect shown above, pass `--name` only for a resolved key collision or an explicit user override.

Run `adt doctor --json` and confirm the Agent Access grant. Establishing the project connection and credentials isn't permission to change FileMaker schema or data; don't run `adt app add` or any `filemaker` write operation yet.

## 3. Run the authenticated read-only inventory

Treat `<source-app-dir>` from section 1 as the source application for all code inspection and baseline checks. Inventory:

- all `@proofkit/*` dependencies and imports;
- every FileMaker script called from application code or generated clients;
- every called script supplied by the ProofKit add-on, distinguished from application-owned scripts;
- each call's parameter and result shapes;
- every FileMaker-side caller of an application-owned wrapper;
- all typegen layouts, output paths, and override files;
- aliases, wrappers, or subclasses of `WebViewerAdapter`;
- custom Vite plugins and build scripts;
- development fallbacks that can bypass FileMaker;
- an unscoped read-only persistent-data listing, including exact `(instance, key)` pairs that may contain the deployed ProofKit app;
- write and external-side-effect flows, including affected records, uploads, email, SMS, payments, and their safe test inputs and cleanup.

Use the exact target spelling and username recorded by `adt connect` for every protected-file read:

```sh
filemaker \
  --file="<exact target from adt.json>" \
  --username="<username from adt.json>" \
  --keychain --prompt \
  <read-only-operations.ndjson>
```

`--prompt` is a fallback for a missing or invalid Keychain credential, not the normal interaction for every command. If credential windows recur, pause the inventory and compare the command with `adt.json`: the target string must match exactly, the username must be present and identical, Keychain access must be allowed, and the saved credential must still be valid. If needed, run `adt connect` once more for that exact target and complete its native prompt. Don't make the user re-enter a password across a series of read-only commands or ask them for it in chat.

Run the source app's existing typecheck, tests, and build from `<source-app-dir>` when those scripts exist. In a monorepo, use the repository's existing filtered workspace commands. Record failures as the baseline. Don't auto-fix or reformat the source.

The inventory is complete only when it includes the script and persistent-data reads needed to populate the single authorization prompt below. Read-only `filemaker` operations may require a full-access account, but they don't authorize or perform FileMaker mutations.

## 4. Ask once before FileMaker writes and app provisioning

After the authenticated read-only inventory, ask one combined question:

> I found `<count>` application-owned FileMaker scripts to update in place, these write or external-side-effect flows to test: `<list with safe test inputs and cleanup>`, and these possible ProofKit deployment entries in persistent data: `<exact instance and key pairs, or none>`. Before I continue, confirm that `<FileMaker target>` has a current restorable backup or is a disposable copy, and authorize me to complete the migration end-to-end, including provisioning the ADT web viewer app, editing those existing scripts, exercising the listed flows, and deleting only confirmed ProofKit deployment entries after you verify the migrated app. At the end, I will ask you to verify the app and uninstall the ProofKit add-on; otherwise I will continue without asking for routine migration approvals.

Include every known side effect in this one prompt. If a flow needs a test recipient, account, record, or cleanup value, request it in the same question. Don't split backup confirmation, app provisioning, script authorization, write-flow authorization, and confirmed persistent-data cleanup authorization into separate prompts.

After confirmation, proceed through all remaining phases without asking again for each script, batch, call-site edit, or write-flow test. FileMaker's native credential or Agent Access windows aren't new approval gates; tell the user when one is waiting and continue after they answer it.

## 5. Plan the ProofKit-to-ADT contracts

Use these contracts when migrating the source app and editing FileMaker scripts in later phases. Don't change application files or FileMaker scripts in this planning phase.

ProofKit and ADT use different FileMaker script contracts:

| Concern | ProofKit | ADT |
|---|---|---|
| Script parameter | `{ data: <payload>, callback: { fetchId, fn, webViewerName } }` | The payload is the top-level JSON value |
| `setWebViewerName()` | Selects the callback target | Compatibility no-op |

Current ADT `fmFetch` handles result transport and parsing. Preserve the value and shape the app expects; don't reproduce its internal Promise, callback, or parsing behavior in migrated application code.

For every application-owned wrapper, keep its name and edit it in place:

- read `Get ( ScriptParameter )` once;
- accept the ADT payload at the top level;
- remove the ADT path's dependency on `callback`, `PK_send_callback`, and the web viewer object name;
- preserve the exact app-facing result value and shape, following the installed ADT `fmFetch` contract;
- use a named off-screen window, closed on every exit path, when FileMaker context is required;
- use `Perform Script on Server` with wait-for-completion only when the behavior is server-safe.

Before changing a result contract, inspect FileMaker-side and remaining ProofKit callers. When an old caller still needs the ProofKit envelope, make the same script dual-contract instead of creating a duplicate: detect the callback envelope, preserve the legacy callback branch for that caller, and use top-level input plus the ADT `fmFetch` contract for ADT calls. The migrated browser path must never enter the ProofKit callback branch.

Use these source and add-on mappings:

| ProofKit source | ADT destination |
|---|---|
| `@proofkit/fmdapi` | `@adt/fmdapi` |
| `@proofkit/webviewer` | `@adt/fmdapi` |
| `@proofkit/webviewer/adapter` | `@adt/fmdapi/adapter` |
| `@proofkit/webviewer/commands` | `@adt/fmdapi/commands` |
| `@proofkit/webviewer/react` | `@adt/fmdapi/react` |
| `@proofkit/webviewer/vite-plugins` | `@adt/fmdapi/vite` |
| `proofkit deploy` | `adt deploy` |
| ProofKit typegen | `adt typegen` |
| `PK_execute_data_api` | `ADT_execute_data_api` |
| `PK_execute_sql` | `ADT_execute_sql` |
| `PK_container_upload` | `ADT_container_upload` |
| `PK_deploy_html` | `adt deploy` |

`PK_execute_sql` must migrate to `ADT_execute_sql`. Verify the ADT script and its request/result contract first, then change the application call site. Apply the same verify-then-repoint rule to every ADT equivalent of a ProofKit add-on script.

Review adapter aliases, custom data sources, deep `/dist` imports, custom FileMaker callbacks, and code that depends on layout, found-set, record, global-variable, or web viewer-name state. ADT typegen imports `WebViewerAdapter` from the `@adt/fmdapi` barrel; preserve intentional interception with a reviewed barrel shim or alias and re-check it after typegen.

## 6. Add the ADT web viewer app

After the user confirms the backup and authorizes FileMaker writes, validate the connection established in section 2 and add the app in the same repository. Use the actual file key from `adt.json`; don't ask the user to repeat or approve it:

For a monorepo source, first inspect the existing workspace patterns. If they don't match `webviewer-apps/<resolved-adt-app-name>`, add the narrowest entry consistent with that repository before running `adt app add`: use the exact app path for an explicit package list, or `webviewer-apps/*` when the workspace groups package directories by wildcard. For example:

```yaml
packages:
  - "apps/*"
  - "packages/*"
  - "webviewer-apps/*"
```

Preserve the existing root package, package manager, workspace options, catalogs, overrides, and security policy.

```sh
ADT_BIN="$HOME/Library/Application Support/ADT/MCP/agent-plugin/bin/adt"
cd "<absolute-proofkit-repository-path>"
sed -n '1,260p' adt.json
"$ADT_BIN" doctor --json
"$ADT_BIN" app add "<resolved-adt-app-name>" \
  --file "<file-key>" --keychain --no-commit --non-interactive
sed -n '1,280p' "webviewer-apps/<resolved-adt-app-name>/adt-project-setup-summary.json"
sed -n '1,280p' "webviewer-apps/<resolved-adt-app-name>/AGENTS.md"
git status --short
```

The `--keychain` lookup must use the account recorded by the earlier `adt connect`. If provisioning reports a credential error, compare the target and username with `adt.json`, rerun `adt connect` once for that same exact target if necessary, complete the native prompt, and retry. Don't fall into repeated password prompts or ask for the password in chat.

For a monorepo source, verify that the existing workspace recognizes the generated package. Read its generated package name and ask pnpm to resolve it:

```sh
APP_DIR="webviewer-apps/<resolved-adt-app-name>"
APP_PACKAGE_NAME="$(node -p "require('./$APP_DIR/package.json').name")"
pnpm --filter "$APP_PACKAGE_NAME" exec pwd
```

If pnpm reports that no project matched, correct the workspace entry or any excluding pattern. Run `pnpm install` from the monorepo root, repeat the filter command, and require it to print the generated app directory before continuing.

Resolve failed scaffold, layout, dependency, tooling, generation, or quality phases before migrating source files.

## 7. Migrate the source app into the ADT workspace

Treat `<source-app-dir>` as the source app and `webviewer-apps/<resolved-adt-app-name>` as the destination app. Move or merge user-owned `src/`, `public/`, static assets, tests, and project-specific configuration into the generated app. Preserve ADT-owned bridge, Intent, manifest, and workspace configuration.

Merge any remaining app-scoped instructions from the source app's `AGENTS.md` or `CLAUDE.md` into the generated app's `AGENTS.md`. Keep the ADT-generated app instructions, translate paths and commands to the new app location, remove duplicates already covered by the merged root instructions, and preserve every still-applicable source rule. Prefer the generated app `AGENTS.md` as the package-level source of truth and make its `CLAUDE.md` point to it with `@AGENTS.md` unless the repository has another established import convention. Re-read both files and check for lost rules or circular imports.

Merge the original app's `package.json` into the generated app package:

- keep `@adt/fmdapi`, `adtMetadata`, ADT scripts, and Intent configuration;
- move non-ProofKit runtime and development dependencies needed by the app;
- preserve useful custom scripts under non-conflicting names;
- keep `deploy: "adt deploy"` and `typegen: "adt typegen"`;
- remove an `@proofkit/*` package only after no remaining import requires it; retain and report packages needed by deferred imports.

For a standalone source, use the ADT-generated root package and workspace files as the workspace authority. For a monorepo source, keep the existing root package and workspace files authoritative and merge only the entries ADT needs. Never replace an established monorepo's root configuration with the source app package or ADT defaults.

Select the active ADT app config before merging typegen settings. Use an explicit `--config` path from the app's typegen script when present; otherwise prefer `adt.config.jsonc`, then `adt.config.json`. Stop if neither exists.

Merge the selected ProofKit config's inner `config` value into that active ADT config:

- preserve `path`, `clearOldFiles`, `clientSuffix`, `validator`, `layouts`, `generateClient`, and `fmMcp`;
- keep the file binding generated from `adt.json`;
- set `webviewerScriptName` to `ADT_execute_data_api` only after the FileMaker script catalog confirms that component exists; otherwise mark typegen blocked pending an adapter decision;
- omit ProofKit-only project keys after recording any behavior they represented.

`clearOldFiles` defaults to `false`. When it is `true`, typegen empties only the configured `path/client` and `path/generated` directories; non-regenerated files in those directories, including hand-written clients, can be removed. Preserve the source value intentionally.

Keep the user's Vite behavior and replace only the ProofKit bridge with ADT's `fmBridge()` integration. Keep the user's UI instead of the starter UI.

Run focused typecheck and tests from the generated app. Keep `<source-app-dir>` intact until its behavior has been migrated, intentionally deferred, or proven obsolete. After the complete browser gate passes, remove only source files proven obsolete or superseded. For a standalone source, remove `proofkit-backup/` when it is empty. For a monorepo source, remove the old package only when the migration replaces it completely; otherwise retain it only as an explicitly documented package with a distinct purpose. Preserve repository documentation, Git configuration, unrelated tooling, and user changes.

## 8. Edit application-owned FileMaker scripts in place

Run diagnostics and inspect live operation shapes:

```sh
ADT_BIN="$HOME/Library/Application Support/ADT/MCP/agent-plugin/bin/adt"
cd "<absolute-proofkit-repository-path>"
"$ADT_BIN" doctor --json
```

```sh
filemaker help script
filemaker help script update
```

Read the script catalog and enumerate ADT components instead of assuming they exist. Classify each app call:

1. **ProofKit add-on script with a verified ADT equivalent:** repoint the app; edit neither installed script.
2. **Application-owned wrapper:** edit that existing script in place for the ADT contract.
3. **Remaining ProofKit add-on script:** leave the add-on installed during migration and report whether anything still calls it. The migration can't proceed to add-on removal while a migrated call site still depends on it.

Maintain a migration table:

| App call site | Script | Action | Contract | Runtime evidence |
|---|---|---|---|---|
| `<file:line>` | `<script>` | repointed/edited/unchanged | ADT/dual/deferred | fresh read and `/__fm/fmfetch` result |

For each application-owned script:

1. Read the script, its `token`, step `uuid` values, callers, side effects, context, and exit paths.
2. Draft the smallest step-level `edits` that implement the ADT or dual contract.
3. Address steps by `uuid`; include `expect` on every edit.
4. Dry-run and require `"errors":0`.
5. Apply, require the closing summary and `"rolledBack":false`.
6. Re-read the script from a fresh process and verify only the intended step ids changed.
7. Exercise it through `POST /__fm/fmfetch` with the same top-level parameter the app sends.
8. Fix failures and repeat within the approved scope; don't create a replacement script or ask for another routine approval.

If a `filemaker` run ends without a summary or times out during apply or commit, treat the outcome as unknown. Read from a fresh process before retrying.

## 9. Verify the complete migration

Install and generate from the in-repository ADT workspace:

```sh
ADT_BIN="$HOME/Library/Application Support/ADT/MCP/agent-plugin/bin/adt"
cd "<absolute-proofkit-repository-path>"
pnpm install

cd "webviewer-apps/<resolved-adt-app-name>"
"$ADT_BIN" typegen
pnpm lint
pnpm build
pnpm dev
```

`adt typegen` uses Agent Access and doesn't accept FileMaker credential flags. Never pass `--reset-overrides` during migration. Don't run `pnpm fix` or another broad auto-fix; report baseline and migration-introduced lint failures separately.

Use the dev server's FileMaker proxy to test every app-called script:

```sh
curl -sS -X POST http://localhost:<port>/__fm/fmfetch \
  -H 'content-type: application/json' \
  -d '{"script":"<script-name>","param":"<top-level-json>"}'
```

Run read-only flows first, then run the write and external-side-effect flows covered by the one approval. Use the inventoried safe inputs and perform the stated cleanup. A script is compatible only when this endpoint returns the exact shape the caller expects.

Re-run the adapter alias search after typegen. Compare typecheck, tests, and build results with the original baseline. Report generated layout clients; when `layouts` is empty, report `tooling wired, app schema not configured yet`.

### Browser completion gate

Use a real browser against the ADT app and exercise every migrated flow. The gate passes only when:

- the app remains loaded after every FileMaker call;
- expected read and write results appear in the UI;
- no development fallback supplies FileMaker data;
- the console has no ProofKit callback warnings, `PK_send_callback` errors, callback timeouts, or missing web viewer-name warnings;
- migrated calls no longer use ProofKit add-on scripts and use verified ADT equivalents;
- application-owned calls use the updated in-place scripts;
- the final production build passes.

Stop the dev server after verification.

## 10. Remove ProofKit deployment data and the add-on

Don't begin this phase merely because the automated checks pass. Summarize the verified flows and ask the user to exercise the migrated app in FileMaker. Continue only after the user confirms that the migrated ADT app works and is ready to replace ProofKit.

Before asking the user to uninstall the ProofKit add-on, inspect FileMaker persistent data for a deployed copy of the ProofKit app:

```sh
filemaker help persistentData
filemaker help persistentData read
filemaker help persistentData delete
```

Run an unscoped `read:persistentData` against the target file so entries from every add-on instance and the empty instance are visible:

```json
{"op":"read:persistentData"}
```

Use the same target and authenticated `filemaker` invocation established during script migration. Identify ProofKit deployment entries from their exact `(instance, key)` pair, the resolved app name, and the stored value. Don't infer ownership from an instance UUID alone, delete by a broad name pattern, or touch unrelated persistent data. If ownership is ambiguous, show the candidate pairs to the user and stop for confirmation.

For every confirmed ProofKit deployment entry, create one explicit delete operation using the exact pair reported by the listing:

```json
{"op":"delete:persistentData","instance":"<exact-instance>","key":"<exact-key>"}
```

Persistent data has no recursive instance deletion. Dry-run the complete delete batch, require `"errors":0`, apply it atomically, require `"rolledBack":false`, and then list persistent data again from a fresh `filemaker` process. Confirm that all identified ProofKit app entries are gone and that unrelated entries are unchanged. If no matching ProofKit deployment data exists, record that result and continue without writing.

After persistent data is clean, tell the user to uninstall the ProofKit add-on from the FileMaker file. The agent must not simulate this UI-only action or delete add-on-owned schema piecemeal. Wait for the user to confirm the uninstall, then perform a final read-only script catalog check: the scripts previously classified as belonging to the ProofKit add-on must be absent, while ADT components and application-owned scripts remain present.

## Completion report

Report:

- repository path and initial/final Git status;
- source package name, suggested and resolved app names, and override;
- ADT file key, target, app binding, and standards pack;
- backup confirmation and the scope covered by the one approval;
- scaffold phase results;
- root and app-level agent instruction files merged, including the canonical file and any retained import convention;
- standalone or monorepo source mode, `<source-app-dir>`, files migrated into the ADT app, and source files removed or deliberately retained;
- for a monorepo, the workspace entry used and evidence that pnpm resolves the generated app package;
- dependency, import, config, Vite, and adapter changes;
- ProofKit add-on calls repointed to ADT equivalents;
- application-owned scripts edited in place, including contract type and step ids changed;
- ProofKit persistent-data entries found and removed, identified by exact instance and key;
- user confirmation that the ProofKit add-on was uninstalled, plus the final script-catalog verification;
- `/__fm/fmfetch` evidence for every app-called script;
- typegen, generated clients, typecheck, test, lint, build, and browser results;
- confirmation that browser verification used no development fallbacks or ProofKit callback path.

Call the migration complete only when the ADT app builds, every app-called FileMaker script has passed `/__fm/fmfetch`, every inventoried flow passes in the browser, the user has verified the migrated app in FileMaker, confirmed ProofKit deployment data is absent, the ProofKit add-on has been uninstalled and verified absent, the console is free of ProofKit callback warnings, all applicable original and ADT agent instructions remain reachable without conflicting duplicates, and the source location contains no unexplained duplicate or unmigrated application code. In a monorepo, pnpm must also resolve the generated app as a workspace package.

If a hard blocker remains, report the exact failed operation, evidence, current FileMaker state, and next required human action. Don't describe a partially verified migration as complete.
