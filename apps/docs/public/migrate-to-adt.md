<!-- vale Vale.Spelling = NO -->
<!-- vale Microsoft.HeadingAcronyms = NO -->
<!-- vale Microsoft.Terms = NO -->
<!-- vale Microsoft.GeneralURL = NO -->

# Migrate a ProofKit Web Viewer Project to an ADT Web Viewer App

Convert the ProofKit Vite web viewer in the current Git repository into an ADT project and web viewer app. Initialize ADT at the repository root, preserve the existing Git history, migrate the application into `webviewer-apps/<app-name>`, and update application-owned FileMaker scripts in place for ADT's runtime contract. Don't create duplicate wrapper scripts.

Work autonomously after one approval gate. Inspect first, ask once for backup confirmation and permission to execute the complete migration, then continue through app changes, FileMaker script edits, write-flow tests, and browser verification without asking for routine approvals again.

## Inputs

- ProofKit repository: the current working directory
- FileMaker target: `<absolute-path-to-file.fmp12-or-fmnet-url>`
- ADT file key: `<file-key>`
- ADT app name: optional override; otherwise derive it from the original `package.json` name

Resolve missing values from the repository, the open FileMaker files, and ADT diagnostics before asking the user. Ask only when a required value can't be discovered.

## Use the installed ADT instructions

Read these installed files from start to finish before running ADT or `fm` commands:

```text
$HOME/Library/Application Support/ADT/MCP/agent-plugin/skills/adt-project-setup/SKILL.md
$HOME/Library/Application Support/ADT/MCP/agent-plugin/skills/adt-webviewer-app/SKILL.md
$HOME/Library/Application Support/ADT/MCP/agent-plugin/skills/fm-cli/SKILL.md
$HOME/Library/Application Support/ADT/MCP/agent-plugin/skills/filemaker-standards/SKILL.md
```

Follow the references those skills require. Resolve the active FileMaker standards before editing scripts.

ADT and `fm` aren't necessarily on the shell `PATH`. Use the launchers installed with ADT, not a cached plugin copy:

```sh
ADT_BIN="$HOME/Library/Application Support/ADT/MCP/agent-plugin/bin/adt"
FM_BIN="$HOME/Library/Application Support/ADT/MCP/fm-cli/fm-cli"
if [ ! -x "$ADT_BIN" ] || [ ! -x "$FM_BIN" ]; then
  echo "ADT or fm launcher not found or not executable" >&2
  exit 1
fi
"$ADT_BIN" --version
"$FM_BIN" --version
```

Redeclare `ADT_BIN` or `FM_BIN` in every new shell process that uses it. Don't change the user's global `PATH` or reinstall ADT because `command -v` fails.

## Operating rules

- Work in the current Git repository. Don't create a sibling migration project or a second Git repository.
- Preserve unrelated and pre-existing working-tree changes. Record the initial status and keep the migration diff scoped.
- Use `adt init . --no-git` so the existing repository remains authoritative.
- Use `adt app add --no-commit` so the scaffold doesn't commit in the middle of the migration.
- Let ADT create its manifest, workspace files, vendored package, components, and app layout.
- Move the application into the generated ADT app. Keep the original root files until the migrated app verifies, then remove only files proven superseded by the ADT copy.
- Update application-owned FileMaker wrappers in place. Preserve their names and FileMaker-side callers. Don't create parallel or suffixed ADT copies.
- Repoint ProofKit component calls to independently verified ADT twins. Keep the old ProofKit components installed; component cleanup is a separate task.
- Use `fm update:script` step edits addressed by `uuid`, with a current `token` and `expect` checks. Never replace an existing script's whole `body`.
- Dry-run every FileMaker write batch, require `"errors":0`, apply it, require `"rolledBack":false`, and verify from a fresh `fm` process.
- Clean up every dev server or watcher started during the migration.

Stop only when the target changes, the backup isn't confirmed, credentials or a FileMaker lock require human action, a tool reports an unknown write outcome, or a required operation is unsupported. A failed check inside the approved migration scope is work to fix, not a reason to ask permission again.

## 1. Inspect the repository and target

Run read-only checks from the repository root:

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

if [ -f proofkit.config.json ]; then
  PROOFKIT_CONFIG=proofkit.config.json
elif [ -f proofkit.json ]; then
  PROOFKIT_CONFIG=proofkit.json
else
  echo "No ProofKit configuration found" >&2
  exit 1
fi

echo "Selected ProofKit config: $PROOFKIT_CONFIG"
sed -n '1,260p' "$PROOFKIT_CONFIG"
sed -n '1,260p' package.json
rg -n '@proofkit/|PK_|fmFetch|callFMScript|PerformScript|WebViewerAdapter|DEV' . \
  -g '!node_modules/**' -g '!dist/**' -g '!pnpm-lock.yaml'
```

When both ProofKit config names exist, `proofkit.config.json` wins. When neither exists, stop and ask which file defines the project before continuing. Confirm that the selected config has `appType: "webviewer"`; stop with a compatibility report for browser and Next.js projects.

Read the original `package.json` name and derive the **suggested** ADT app name:

1. Remove an npm scope. `@acme/inventory-viewer` becomes `inventory-viewer`.
2. Convert the remainder to kebab-case.
3. Use a user-supplied override as the **resolved** name; otherwise use the suggestion.
4. Report the source package name, suggested name, and resolved name separately.

Check collisions using the resolved name. Ask for another name only when the resolved `webviewer-apps/<name>` already exists or the package has no usable name.

Inventory:

- all `@proofkit/*` dependencies and imports;
- every FileMaker script called from application code or generated clients;
- each call's parameter and result shapes;
- every FileMaker-side caller of an application-owned wrapper;
- all typegen layouts, output paths, and override files;
- aliases, wrappers, or subclasses of `WebViewerAdapter`;
- custom Vite plugins and build scripts;
- development fallbacks that can bypass FileMaker;
- write and external-side-effect flows, including affected records, uploads, email, SMS, payments, and their safe test inputs and cleanup.

Run the source repository's existing typecheck, tests, and build when those scripts exist. Record failures as the baseline. Don't auto-fix or reformat the source.

## 2. Ask once before writes

After the read-only inventory, ask one combined question:

> I found `<count>` application-owned FileMaker scripts to update in place and these write or external-side-effect flows to test: `<list with safe test inputs and cleanup>`. Before I continue, confirm that `<FileMaker target>` has a current restorable backup or is a disposable copy, and authorize me to complete the migration end-to-end, including editing those existing scripts and exercising the listed flows against this target. After confirmation, I will continue without asking for routine migration approvals.

Include every known side effect in this one prompt. If a flow needs a test recipient, account, record, or cleanup value, request it in the same question. Don't split backup confirmation, script authorization, and write-flow authorization into separate prompts.

After confirmation, proceed through all remaining phases without asking again for each script, batch, call-site edit, or write-flow test. FileMaker's native credential or Agent Access windows aren't new approval gates; tell the user when one is waiting and continue after they answer it.

## 3. Apply the ProofKit-to-ADT contracts

ProofKit and ADT use different FileMaker script contracts:

| Concern | ProofKit | ADT |
|---|---|---|
| Script parameter | `{ data: <payload>, callback: { fetchId, fn, webViewerName } }` | The payload is the top-level JSON value |
| Result path | `PK_send_callback` performs JavaScript in a named web viewer | `PerformScriptAsync` resolves from `Exit Script [ Result ]` |
| `setWebViewerName()` | Selects the callback target | Compatibility no-op |
| Layout navigation | May be tolerated | `Go to Layout` in the visible web viewer window unloads the app |
| Empty or non-JSON result | Callback-specific | `""` becomes `undefined`; non-JSON remains a string |

For every application-owned wrapper, keep its name and edit it in place:

- read `Get ( ScriptParameter )` once;
- accept the ADT payload at the top level;
- remove the ADT path's dependency on `callback`, `PK_send_callback`, and the web viewer object name;
- return the exact app-facing result through `Exit Script [ $result ]` on every ADT path;
- use a named off-screen window, closed on every exit path, when FileMaker context is required;
- use `Perform Script on Server` with wait-for-completion only when the behavior is server-safe.

Before changing a result contract, inspect FileMaker-side and remaining ProofKit callers. When an old caller still needs the ProofKit envelope, make the same script dual-contract instead of creating a duplicate: detect the callback envelope, preserve the legacy callback branch for that caller, and use top-level input plus `Exit Script` for ADT calls. The migrated browser path must never enter the ProofKit callback branch.

Use these source and component mappings:

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

`PK_execute_sql` must migrate to `ADT_execute_sql`. Verify the ADT component and its request/result contract first, then change the application call site. Apply the same verify-then-repoint rule to every ADT twin.

Review adapter aliases, custom data sources, deep `/dist` imports, custom FileMaker callbacks, and code that depends on layout, found-set, record, global-variable, or web viewer-name state. ADT typegen imports `WebViewerAdapter` from the `@adt/fmdapi` barrel; preserve intentional interception with a reviewed barrel shim or alias and re-check it after typegen.

## 4. Initialize ADT in the current repository

If the root already contains `adt.json`, validate and continue it. Otherwise initialize in place:

```sh
ADT_BIN="$HOME/Library/Application Support/ADT/MCP/agent-plugin/bin/adt"
cd "<absolute-proofkit-repository-path>"
"$ADT_BIN" init . --target "<absolute-path-to-file.fmp12-or-fmnet-url>" --no-git
sed -n '1,260p' adt.json
"$ADT_BIN" standards
```

Read the generated root `AGENTS.md` and every standards file reported by `adt standards`. State the active standards pack.

If `adt init` doesn't record the intended file or key, connect it explicitly:

```sh
ADT_BIN="$HOME/Library/Application Support/ADT/MCP/agent-plugin/bin/adt"
cd "<absolute-proofkit-repository-path>"
"$ADT_BIN" connect "<absolute-path-to-file.fmp12-or-fmnet-url>" --name "<file-key>"
```

Tell the user when FileMaker Pro is waiting for its Agent Access or credential window. Confirm the target and grant before continuing.

Add the app in the same repository:

```sh
ADT_BIN="$HOME/Library/Application Support/ADT/MCP/agent-plugin/bin/adt"
cd "<absolute-proofkit-repository-path>"
"$ADT_BIN" app add "<resolved-adt-app-name>" \
  --file "<file-key>" --keychain --no-commit --non-interactive
sed -n '1,280p' "webviewer-apps/<resolved-adt-app-name>/adt-project-setup-summary.json"
sed -n '1,280p' "webviewer-apps/<resolved-adt-app-name>/AGENTS.md"
git status --short
```

Resolve failed scaffold, layout, dependency, tooling, generation, or quality phases before migrating source files.

## 5. Move the app into the ADT workspace

Treat the original repository root as the source app and `webviewer-apps/<resolved-adt-app-name>` as the destination app. Merge user-owned `src/`, `public/`, static assets, tests, and project-specific configuration into the generated app. Preserve ADT-owned bridge, Intent, manifest, and workspace configuration.

Merge the original app's `package.json` into the generated app package:

- keep `@adt/fmdapi`, `adtMetadata`, ADT scripts, and Intent configuration;
- move non-ProofKit runtime and development dependencies needed by the app;
- preserve useful custom scripts under non-conflicting names;
- keep `deploy: "adt deploy"` and `typegen: "adt typegen"`;
- remove an `@proofkit/*` package only after no remaining import requires it; retain and report packages needed by deferred imports.

Use the ADT-generated root package and workspace files as the workspace authority. Don't replace them with the original app package.

Select the active ADT app config before merging typegen settings. Use an explicit `--config` path from the app's typegen script when present; otherwise prefer `adt.config.jsonc`, then `adt.config.json`. Stop if neither exists.

Merge the selected ProofKit config's inner `config` value into that active ADT config:

- preserve `path`, `clearOldFiles`, `clientSuffix`, `validator`, `layouts`, `generateClient`, and `fmMcp`;
- keep the file binding generated from `adt.json`;
- set `webviewerScriptName` to `ADT_execute_data_api` only after the FileMaker script catalog confirms that component exists; otherwise mark typegen blocked pending an adapter decision;
- omit ProofKit-only project keys after recording any behavior they represented.

`clearOldFiles` defaults to `false`. When it is `true`, typegen empties only the configured `path/client` and `path/generated` directories; non-regenerated files in those directories, including hand-written clients, can be removed. Preserve the source value intentionally.

Keep the user's Vite behavior and replace only the ProofKit bridge with ADT's `fmBridge()` integration. Keep the user's UI instead of the starter UI.

Run focused typecheck and tests from the generated app. When they pass, remove only root-level app files that are now superseded by verified files inside the ADT app. Preserve repository documentation, Git configuration, unrelated tooling, and user changes.

## 6. Edit application-owned FileMaker scripts in place

Run diagnostics and inspect live operation shapes:

```sh
ADT_BIN="$HOME/Library/Application Support/ADT/MCP/agent-plugin/bin/adt"
cd "<absolute-proofkit-repository-path>"
"$ADT_BIN" doctor --json
```

```sh
FM_BIN="$HOME/Library/Application Support/ADT/MCP/fm-cli/fm-cli"
"$FM_BIN" help script
"$FM_BIN" help script update
```

Read the script catalog and enumerate ADT components instead of assuming they exist. Classify each app call:

1. **ProofKit component with a verified ADT twin:** repoint the app; edit neither component.
2. **Application-owned wrapper:** edit that existing script in place for the ADT contract.
3. **Remaining ProofKit component:** leave installed and report whether anything still calls it.

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

If an `fm` run ends without a summary or times out during apply or commit, treat the outcome as unknown. Read from a fresh process before retrying.

## 7. Verify the complete migration

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
- migrated component calls use ADT twins;
- application-owned calls use the updated in-place scripts;
- the final production build passes.

Stop the dev server after verification.

## Completion report

Report:

- repository path and initial/final Git status;
- source package name, suggested and resolved app names, and override;
- ADT file key, target, app binding, and standards pack;
- backup confirmation and the scope covered by the one approval;
- scaffold phase results;
- files moved into the ADT app and superseded root files removed;
- dependency, import, config, Vite, and adapter changes;
- ProofKit component calls repointed to ADT twins;
- application-owned scripts edited in place, including contract type and step ids changed;
- ProofKit components and scripts left installed;
- `/__fm/fmfetch` evidence for every app-called script;
- typegen, generated clients, typecheck, test, lint, build, and browser results;
- confirmation that browser verification used no development fallbacks or ProofKit callback path.

Call the migration complete only when the ADT app builds, every app-called FileMaker script has passed `/__fm/fmfetch`, every inventoried flow passes in the browser, the console is free of ProofKit callback warnings, and the repository no longer retains a duplicate root copy of the migrated app.

If a hard blocker remains, report the exact failed operation, evidence, current FileMaker state, and next required human action. Don't describe a partially verified migration as complete.
