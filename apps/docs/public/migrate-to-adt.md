<!-- vale Vale.Spelling = NO -->
<!-- vale Microsoft.HeadingAcronyms = NO -->
<!-- vale Microsoft.Terms = NO -->
<!-- vale Microsoft.GeneralURL = NO -->

# Migrate a ProofKit Web Viewer Project to an ADT Web Viewer App

Migrate the supplied ProofKit Vite web viewer into a new ADT web viewer app. Preserve the ProofKit source and all existing FileMaker scripts. Treat the FileMaker file as an active part of the migration: use ADT-provisioned components where they are compatible, and create new parallel ADT wrapper scripts for application-specific flows. Never modify, rename, or delete an old ProofKit wrapper.

Continue through compatible work instead of stopping at the first incompatible script. Stop only for a required decision, an unsafe FileMaker write, or a flow that can't be verified.

## Inputs

- ProofKit project: `<absolute-source-project-path>`
- ADT project destination: `<absolute-adt-project-path>`
- FileMaker target: `<absolute-path-to-file.fmp12-or-fmnet-url>`
- ADT file key: `<file-key>`
- ADT app name: optional override; otherwise derive it from the source `package.json` name

If an input is missing and you can't resolve it from the project, ask one concise question before making changes. Create the ADT project outside the ProofKit project. Keep the ProofKit source unchanged.

## Use the installed ADT instructions

Read each of these files from start to finish before running ADT or `fm` commands:

```text
$HOME/Library/Application Support/ADT/MCP/agent-plugin/skills/adt-project-setup/SKILL.md
$HOME/Library/Application Support/ADT/MCP/agent-plugin/skills/adt-webviewer-app/SKILL.md
$HOME/Library/Application Support/ADT/MCP/agent-plugin/skills/fm-cli/SKILL.md
$HOME/Library/Application Support/ADT/MCP/agent-plugin/skills/filemaker-standards/SKILL.md
```

Follow every additional file that those skills require. In particular, resolve and read the active FileMaker naming and pattern standards before naming or creating a script.

ADT and `fm` aren't necessarily on the user's shell `PATH`. Resolve the launchers installed with the agent plugin once, then use those exact paths:

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

Don't conclude that ADT is missing from a failed `command -v adt`, don't change the user's global `PATH`, and don't substitute a cached plugin binary. Redeclare `ADT_BIN` or `FM_BIN` in every new shell process that uses it because shell variables don't persist across tool calls. Follow the destination project's `AGENTS.md` after `adt init`, and the app's `AGENTS.md` after `adt app add`.

## Guardrails

- Preserve the source project and its Git history. Migrate into a new destination.
- Preserve user-written source, routes, components, styles, public assets, and custom dependencies.
- Let `adt init` and `adt app add` create ADT-owned manifests, workspace files, vendored packages, FileMaker components, and the app layout.
- Regenerate schema clients with ADT instead of copying them.
- Never modify, rename, or delete an existing FileMaker script. Create a new parallel ADT wrapper when an application-specific ProofKit wrapper has an incompatible contract.
- Keep ProofKit components in the FileMaker file. They can become unused after the app is repointed; cleanup is a separate task.
- Never change an existing FileMaker layout or web viewer object without explicit approval.
- Confirm a backup exists, or work against a copy, before the first FileMaker schema write.
- Test read-only application flows first. Before exercising any flow that creates, updates, or deletes records, uploads a file, sends a message, charges money, or causes another external side effect, describe the exact test and ask for approval. Approval may cover a clearly enumerated batch. Continue all read-only work while write-flow approval is pending.
- Rewrite an application call site only after its replacement ADT component or new wrapper has passed an independent `/__fm/fmfetch` round trip. If a write flow isn't approved for testing, leave its call site unchanged and report it as deferred.
- Clean up every dev server or watcher started during the migration.

## 1. Inspect the source and environment

Run read-only checks first:

```sh
ADT_BIN="$HOME/Library/Application Support/ADT/MCP/agent-plugin/bin/adt"
cd "<absolute-source-project-path>"
pwd
git status --short
proofkit --version
"$ADT_BIN" --version
uname -s
node -v
pnpm -v
for config in proofkit.config.json proofkit.json; do
  if [ -f "$config" ]; then
    echo "$config"
    sed -n '1,240p' "$config"
  fi
done
sed -n '1,240p' package.json
rg -n '@proofkit/|PK_|fmFetch|callFMScript|PerformScript|WebViewerAdapter|DEV' . \
  -g '!node_modules/**' -g '!dist/**' -g '!pnpm-lock.yaml'
```

Treat either `proofkit.config.json` or `proofkit.json` as authoritative. Confirm that its `appType` is `webviewer`. Stop with a compatibility report if it's a browser or Next.js project.

Read the `name` field from the source `package.json` and derive the **suggested** ADT app name:

1. Remove an npm scope. For example, `@acme/inventory-viewer` becomes `inventory-viewer`.
2. Convert the remaining name to kebab-case: lowercase it, replace each run of non-alphanumeric characters with one hyphen, and trim leading or trailing hyphens.
3. If the user supplied an override, that override is the **resolved** ADT app name. Otherwise, the suggested name is the resolved name.
4. Before making changes, report both values: `Suggested ADT app name: <suggested-name> (from package.json name <source-package-name>). Resolved ADT app name: <resolved-name>.`

Ask for an app name only when `package.json` has no usable name or the destination for the **resolved** name already exists. Use `<resolved-adt-app-name>` for every later path and command.

Build a source inventory containing:

- every `@proofkit/*` dependency and import;
- every FileMaker script name called by `fmFetch`, `callFMScript`, generated clients, or direct `window.FileMaker` calls;
- each call's top-level parameter shape and expected result shape;
- configured typegen layouts and schema output paths;
- aliases, wrappers, or subclasses of `WebViewerAdapter`;
- custom Vite plugins and build scripts;
- any remote FileMaker, OttoFMS, or server-side data source;
- every development fallback that can bypass FileMaker.

Before changing the source, run its existing typecheck and test commands when present. Record failures as the baseline so only new failures are attributed to the migration. Don't invent a new source command when the package has none.

## 2. Understand the runtime contract change

ProofKit and ADT use different FileMaker script contracts:

| Concern | ProofKit | ADT |
|---|---|---|
| Script parameter | `{ data: <payload>, callback: { fetchId, fn, webViewerName } }`; wrappers commonly read `JSONGetElement ( $json ; "data" )` | The payload is the top-level JSON value; read it from `Get ( ScriptParameter )` |
| Result path | A script calls `PK_send_callback`, which performs JavaScript in a named web viewer | `PerformScriptAsync` resolves from that script's `Exit Script [ Result ]` |
| `setWebViewerName()` | Selects the callback target | A compatibility no-op; don't rely on it |
| Layout navigation | Often tolerated | `Go to Layout` in the visible web viewer window unloads the app |
| Empty or non-JSON result | Callback-specific | `""` resolves as `undefined`; a non-JSON string passes through as a raw string |

Every new ADT wrapper must have an explicit contract:

- **Parameter:** one JSON value at the top level, with no `data` or `callback` envelope. Read `Get ( ScriptParameter )` once and extract named local variables from it.
- **Result:** one value returned by `Exit Script [ $result ]` on every path. When returning JSON, return the exact JSON shape the TypeScript caller expects; don't add or remove an envelope silently. Follow the resolved FileMaker standards for success and error objects. Don't use an empty success result unless the caller intentionally expects `undefined`.
- **Context:** don't use `Go to Layout` in the web viewer's visible window. When local layout context is necessary, open a named off-screen window on the required context layout and close it on every exit path. Use `Perform Script on Server` with wait-for-completion only when the operation is server-safe and doesn't require client-only state.

The following source changes are mechanical:

| ProofKit source | ADT destination |
|---|---|
| `@proofkit/fmdapi` | `@adt/fmdapi` |
| `@proofkit/webviewer` | `@adt/fmdapi` |
| `@proofkit/webviewer/adapter` | `@adt/fmdapi/adapter` |
| `@proofkit/webviewer/commands` | `@adt/fmdapi/commands` |
| `@proofkit/webviewer/react` | `@adt/fmdapi/react` |
| `@proofkit/webviewer/vite-plugins` | `@adt/fmdapi/vite` |
| `proofkit deploy` | `adt deploy` |
| ProofKit typegen command | `adt typegen` |
| `PK_execute_data_api` | `ADT_execute_data_api` |
| `PK_execute_sql` | `ADT_execute_sql` |
| `PK_container_upload` | `ADT_container_upload` |
| `PK_deploy_html` | `adt deploy` |

`PK_execute_sql` **must migrate to `ADT_execute_sql`** in the new app. First verify that ADT provisioned `ADT_execute_sql` and independently test its expected request and response contract. Only then change the application call site. If the contracts differ, don't retain `PK_execute_sql` as a silent fallback; leave the call site unchanged and report the flow as blocked pending an explicit adapter decision.

Treat these as review boundaries rather than blind replacements:

- `FetchAdapter`, `FmMcpAdapter`, or `OttoAdapter`;
- any alias, wrapper, or subclass of `WebViewerAdapter`;
- `@proofkit/webviewer/nextjs`;
- genuine deep imports such as `@proofkit/fmdapi/dist/...`;
- nonempty ProofKit `dataSources`;
- custom callback functions injected by FileMaker scripts;
- code that depends on an existing FileMaker layout, found set, record context, global variables, or web viewer object name.

ADT typegen imports `WebViewerAdapter` from the `@adt/fmdapi` package barrel. A source project that intercepts the ProofKit adapter subpath can therefore build successfully while silently losing that behavior. Before typegen, record every adapter alias and subclass. After typegen, inspect generated imports and preserve intentional interception with a reviewed barrel shim or alias when necessary. Re-run the adapter search after generation.

## 3. Initialize the ADT project

Confirm that the destination is absent or empty. Stop if it contains an existing project or user files. Then use the supported ADT commands rather than recreating their output by hand:

```sh
ADT_BIN="$HOME/Library/Application Support/ADT/MCP/agent-plugin/bin/adt"
mkdir -p "<absolute-adt-project-path>"
cd "<absolute-adt-project-path>"
"$ADT_BIN" init . --target "<absolute-path-to-file.fmp12-or-fmnet-url>"
sed -n '1,240p' adt.json
"$ADT_BIN" standards
```

Read every naming and pattern standards file reported by `adt standards`. State which standards pack is active before naming FileMaker objects.

If `adt init` records no file or the intended key differs, connect it explicitly:

```sh
ADT_BIN="$HOME/Library/Application Support/ADT/MCP/agent-plugin/bin/adt"
cd "<absolute-adt-project-path>"
"$ADT_BIN" connect "<absolute-path-to-file.fmp12-or-fmnet-url>" --name "<file-key>"
```

Tell the user to allow the FileMaker Pro Agent Access prompt if ADT displays one. Confirm the target and access result before proceeding.

## 4. Add the ADT web viewer app

State that the next command may provision ADT-owned FileMaker components and create a new app layout. Then run:

```sh
ADT_BIN="$HOME/Library/Application Support/ADT/MCP/agent-plugin/bin/adt"
cd "<absolute-adt-project-path>"
"$ADT_BIN" app add "<resolved-adt-app-name>" --file "<file-key>" --keychain --non-interactive
sed -n '1,260p' "webviewer-apps/<resolved-adt-app-name>/adt-project-setup-summary.json"
sed -n '1,260p' "webviewer-apps/<resolved-adt-app-name>/AGENTS.md"
```

Resolve any failed scaffold, dependency, tooling, or layout phase before copying application code.

## 5. Move only user-owned application files

Copy the source project's user-owned files into the generated ADT app. Typical inputs are `src/`, `public/`, static assets, and project-specific configuration. Exclude at least:

```text
.git/
node_modules/
dist/
.env*
pnpm-lock.yaml
proofkit.config.json
proofkit.json
proofkit-setup-summary.json
proofkit-setup.log
```

Merge `package.json` instead of replacing it:

- keep ADT's `@adt/fmdapi` dependency, `adtMetadata`, Intent configuration, and ADT scripts;
- preserve non-ProofKit dependencies and custom scripts;
- remove `@proofkit/webviewer`, `@proofkit/fmdapi`, and `@proofkit/typegen` only after every usage has been mapped or reported;
- keep `deploy: "adt deploy"` and `typegen: "adt typegen"`;
- preserve the source package name only if it remains unique in the ADT workspace.

Rewrite only the supported imports listed in the compatibility table. Preserve review boundaries until their behavior is understood.

Merge the inner `config` object from the detected ProofKit configuration into `adt.config.json`:

- preserve `path`, `clearOldFiles`, `clientSuffix`, `validator`, and `layouts`;
- use `ADT_execute_data_api` as `webviewerScriptName`;
- keep the file binding produced by ADT;
- omit ProofKit-only top-level keys such as `appType`, `ui`, `dataSources`, `envFile`, `registryTemplates`, and `replacedMainPage` after recording any behavior they represented.

Preserve `clearOldFiles: false` when the source uses it; ADT's `true` default can delete hand-written clients that aren't listed in `layouts`.

Keep the user's Vite configuration and replace only the bridge import and call needed for ADT. Keep the user's UI instead of copying the current ADT starter UI over it.

## 6. Inventory and classify the FileMaker boundary

Run ADT diagnostics, then use the installed `fm-cli` skill for read-only script inventory:

```sh
ADT_BIN="$HOME/Library/Application Support/ADT/MCP/agent-plugin/bin/adt"
cd "<absolute-adt-project-path>"
"$ADT_BIN" doctor --json
```

```sh
FM_BIN="$HOME/Library/Application Support/ADT/MCP/fm-cli/fm-cli"
"$FM_BIN" help script
"$FM_BIN" help script create
"$FM_BIN" help script update
```

Use the target recorded in `adt.json` and the live-help operation shapes. Enumerate ADT-provisioned scripts by reading the catalog and filtering `ADT_`; don't assume a component exists because it appears in this prompt.

Classify every script the app calls:

1. **ProofKit component with an ADT twin:** repoint the app only after verifying the ADT twin. Don't edit either script.
2. **Application-specific ProofKit wrapper:** create a new parallel ADT wrapper, verify it independently, and then repoint that one app call site. Never modify the old wrapper.
3. **Remaining ProofKit component:** leave it in place. It can become dead code after all callers move.

Maintain this table throughout the migration:

| App call site | Legacy script | Replacement | Flow kind | Contract status | Evidence |
|---|---|---|---|---|---|
| `<file:line>` | `<PK or user script>` | `<ADT twin or new wrapper>` | read/write/external side effect | planned/verified/deferred/blocked | source, FileMaker read, and round trip |

## 7. Create and verify parallel ADT wrappers

Work one application-specific flow at a time. Prefer a new parallel wrapper even when editing the old wrapper looks mechanical.

### Naming convention

ADT-provisioned components retain their `ADT_*` names. For a new application-specific wrapper, follow the active standards pack and use this default when it doesn't override script naming:

```text
<Verb phrase describing the legacy purpose> for ADT ( <required top-level JSON keys> )
```

Omit parentheses when the wrapper takes no parameters. Keep the name within FileMaker's 100-character limit; if listing every key would exceed it, name the top-level object `request` in the signature and document every required key in the script header. Examples: `Get Session for ADT` and `Save Sale Line for ADT ( saleLine )`. Place the wrapper in the existing functional folder for that behavior. Record the exact legacy-to-ADT name mapping before writing it.

### Authoring and write safety

For each wrapper:

1. Read the legacy script and every FileMaker-side caller. Record its inputs, outputs, context, side effects, and all exit paths.
2. Design the new top-level parameter and `Exit Script` result contracts. Add the comment header required by the active standards.
3. If context is required, use a named off-screen window on a context-only layout. Close it on every success and error path. Never navigate the visible web viewer window.
4. Create a new script. Don't rename, patch, or replace the legacy script. Use `update:script` edits only against the newly-created wrapper, address existing steps by `uuid`, and include `expect` checks. Never send a whole replacement body to an existing script.
5. Dry-run the complete batch and require a closing summary with `"errors":0` before applying it.
6. Apply the batch, require `"rolledBack":false`, and then verify the new script with `read:script` from a fresh `fm` process.
7. Keep the legacy wrapper and all ProofKit components in place.

The new wrapper must not call `PK_send_callback`, construct a ProofKit callback envelope, depend on `setWebViewerName()`, or use a ProofKit component when an independently verified ADT twin exists.

### Independent runtime verification

Start the ADT dev server and use its live FileMaker proxy. A successful HTTP response alone isn't enough; verify the returned value and shape:

```sh
cd "<absolute-adt-project-path>/webviewer-apps/<resolved-adt-app-name>"
pnpm dev
```

From another shell, test a read-only probe and then each replacement script:

```sh
curl -sS -X POST http://localhost:<port>/__fm/fmfetch \
  -H 'content-type: application/json' \
  -d '{"script":"ADT_probe","param":"{}"}'
```

For a new wrapper, send the same top-level JSON shape the application will send. Mark it `verified` only when the endpoint executes the intended new script and returns the exact success or error shape the app expects.

Test all read-only flows first. Before invoking a write or external-side-effect wrapper, tell the user the target file, script, parameter summary, expected records or external systems affected, and cleanup plan, then ask for approval. Don't infer approval from the original migration request. If approval is declined or unavailable, don't invoke the flow and don't repoint its call site.

After each replacement passes independently:

1. Change only that application call site to the verified ADT script name.
2. Run the focused test or typecheck for the changed caller.
3. Exercise the flow through the application when safe.
4. Update the migration table before moving to the next flow.

## 8. Regenerate and verify the ADT app

Install from the ADT workspace root, then verify from the app directory:

```sh
ADT_BIN="$HOME/Library/Application Support/ADT/MCP/agent-plugin/bin/adt"
cd "<absolute-adt-project-path>"
pnpm install

cd "webviewer-apps/<resolved-adt-app-name>"
"$ADT_BIN" typegen
pnpm lint
pnpm build
pnpm dev
```

`adt typegen` uses Agent Access. It doesn't accept FileMaker credential flags. Never pass `--reset-overrides` during a migration because user-editable schema override files may contain application logic.

Typegen must exit zero, but that alone doesn't prove success. Report whether it generated layout client files. If `layouts` is empty, say: `tooling wired, app schema not configured yet`.

Don't run `pnpm fix` or another broad auto-fix. On a migrated codebase, report the lint count and leading rules separately from migration-introduced failures. Warn before committing if hooks would reformat unrelated source.

Re-run the adapter alias search after typegen and confirm generated clients still use any required adapter interception. Compare the destination's typecheck and test results with the recorded source baseline.

### Browser completion gate

Use a real browser against the running ADT app and exercise every repointed flow that has permission to run. Inspect both the page and browser console. The browser gate passes only when:

- the app loads and remains loaded after every FileMaker call;
- expected read results and approved write results appear in the UI;
- the network and console show no development fallback supplying FileMaker data;
- there are no ProofKit callback warnings, `PK_send_callback` errors, callback timeouts, or missing web viewer-name warnings;
- there are no calls to legacy ProofKit scripts from migrated call sites;
- a production build passes after browser verification.

Disable or bypass development fallback data for this gate. A UI that succeeds because a fallback masked a failed FileMaker call doesn't pass.

Stop the dev server after verification.

## Completion report

Report:

- source and destination paths;
- source package name, suggested ADT app name, resolved app name, and any override;
- ADT project, file key, target, and app binding from `adt.json`;
- active FileMaker standards pack and backup evidence;
- `adt app add` phase results;
- every dependency, import, config, and adapter rewrite;
- scripts repointed to ADT twins;
- new parallel wrappers, including legacy/new names, top-level parameter shape, result shape, context strategy, and FileMaker step ids created or changed;
- scripts and call sites left unchanged;
- write flows approved and exercised, and flows declined or deferred;
- `/__fm/fmfetch` evidence for every migrated call site;
- typegen output and whether it generated layout clients;
- baseline and destination typecheck, test, lint, and build results;
- browser verification, including confirmation that DEV fallbacks were disabled and no ProofKit callback warnings occurred;
- confirmation that source files, existing FileMaker scripts, and ProofKit components weren't modified or removed.

Call the migration complete only when the app builds, every migrated call site has passed an independent `/__fm/fmfetch` round trip, every permitted flow passes in the browser without development fallbacks or ProofKit callback warnings, and no migrated call site still invokes a legacy ProofKit script.

If write-flow verification wasn't approved, call the result `migration implemented; write verification deferred`, not complete. If an individual flow is blocked, continue the others and report that flow precisely instead of stopping the whole migration.
