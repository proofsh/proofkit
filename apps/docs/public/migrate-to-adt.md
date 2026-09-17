<!-- vale Vale.Spelling = NO -->
<!-- vale Microsoft.HeadingAcronyms = NO -->
<!-- vale Microsoft.Terms = NO -->
<!-- vale Microsoft.GeneralURL = NO -->

# Migrate a ProofKit Web Viewer Project to an ADT Web Viewer App

Migrate the supplied ProofKit Vite web viewer into a new ADT web viewer app. Preserve the application code and treat the FileMaker file as a separate compatibility boundary. ADT may provision its own components and app layout, but this migration must not edit, rename, or delete existing FileMaker scripts or remove ProofKit components.

## Inputs

- ProofKit project: `<absolute-source-project-path>`
- ADT project destination: `<absolute-adt-project-path>`
- FileMaker target: `<absolute-path-to-file.fmp12-or-fmnet-url>`
- ADT file key: `<file-key>`
- ADT app name: `<kebab-case-app-name>`

If an input is missing and you can't resolve it from the project, ask one concise question before making changes. Create the ADT project outside the ProofKit project. Keep the ProofKit source unchanged.

## Use the installed ADT instructions

Read each of these files from start to finish before running ADT commands:

```text
$HOME/Library/Application Support/ADT/MCP/agent-plugin/skills/adt-project-setup/SKILL.md
$HOME/Library/Application Support/ADT/MCP/agent-plugin/skills/adt-webviewer-app/SKILL.md
$HOME/Library/Application Support/ADT/MCP/agent-plugin/skills/fm-cli/SKILL.md
$HOME/Library/Application Support/ADT/MCP/agent-plugin/skills/filemaker-standards/SKILL.md
```

ADT isn't necessarily on the user's shell `PATH`. Resolve and verify the launcher installed with the agent plugin once, then use it for every ADT operation:

```sh
ADT_BIN="$HOME/Library/Application Support/ADT/MCP/agent-plugin/bin/adt"
if [ ! -x "$ADT_BIN" ]; then
  echo "ADT launcher not found or not executable: $ADT_BIN" >&2
  exit 1
fi
"$ADT_BIN" --version
```

Don't conclude that ADT is missing from a failed `command -v adt`, don't change the user's global `PATH`, and don't substitute a cached plugin binary. Redeclare `ADT_BIN` in each new shell process because shell variables don't persist across tool calls. Follow the destination project's `AGENTS.md` after `"$ADT_BIN" init`, and the app's `AGENTS.md` after `"$ADT_BIN" app add`.

## Guardrails

- Preserve the source project and its Git history. Migrate into a new destination.
- Preserve user-written source, routes, components, styles, public assets, and custom dependencies.
- Let `adt init` and `adt app add` create ADT-owned manifests, workspace files, vendored packages, FileMaker components, and the app layout.
- Regenerate schema clients with ADT instead of copying them.
- Keep every existing FileMaker script unchanged, including its name.
- Keep ProofKit components in the FileMaker file. Report them as later cleanup after the migrated app passes verification.
- Treat matching script names as unverified until their contracts match.
- Stop before changing an existing FileMaker layout or web viewer object. Explain the required change and ask for approval.
- Clean up every dev server or watcher started during the migration.

## 1. Inspect the source and environment

Run read-only checks first:

```sh
cd "<absolute-source-project-path>"
pwd
git status --short
proofkit --version
"$ADT_BIN" --version
uname -s
node -v
pnpm -v
cat proofkit.config.json
cat package.json
rg -n '@proofkit/|PK_|fmFetch|callFMScript|PerformScript' . \
  -g '!node_modules/**' -g '!dist/**' -g '!pnpm-lock.yaml'
```

Confirm that `proofkit.config.json` has `appType: "webviewer"`. Stop with a compatibility report if it's a browser or Next.js project.

Build a source inventory containing:

- every `@proofkit/*` dependency and import;
- every FileMaker script name called by `fmFetch`, `callFMScript`, generated clients, or direct `window.FileMaker` calls;
- configured typegen layouts and schema output paths;
- custom Vite plugins and build scripts;
- any remote FileMaker, OttoFMS, or server-side data source.

## 2. Classify compatibility before migration

The following mappings are mechanical:

| ProofKit source | ADT destination |
|---|---|
| `@proofkit/webviewer` | `@adt/fmdapi` |
| `@proofkit/webviewer/adapter` | `@adt/fmdapi/adapter` |
| `@proofkit/webviewer/commands` | `@adt/fmdapi/commands` |
| `@proofkit/webviewer/react` | `@adt/fmdapi/react` |
| `@proofkit/webviewer/vite-plugins` | `@adt/fmdapi/vite` |
| `proofkit deploy` | `adt deploy` |
| ProofKit typegen command | `adt typegen` |
| `PK_execute_data_api` | `ADT_execute_data_api` |

Treat these as review boundaries rather than automatic replacements:

- `FetchAdapter`, `FmMcpAdapter`, or `OttoAdapter`;
- `@proofkit/webviewer/nextjs`;
- deep imports from `@proofkit/fmdapi`;
- nonempty ProofKit `dataSources`;
- direct calls to ProofKit-owned `PK_*` scripts;
- custom callback functions injected by FileMaker scripts;
- code that depends on an existing FileMaker layout, found set, record context, global variables, or web viewer object name.

If a review boundary is present, continue with the compatible project setup but don't report a completed application conversion. List the exact file, import or script call, and the decision still required.

## 3. Initialize the ADT project

Run the supported ADT commands rather than recreating their output by hand:

Confirm that the destination is absent or empty before creating it. Stop if it contains an existing project or user files.

```sh
mkdir -p "<absolute-adt-project-path>"
cd "<absolute-adt-project-path>"
"$ADT_BIN" init . --target "<absolute-path-to-file.fmp12-or-fmnet-url>"
cat adt.json
"$ADT_BIN" standards
```

If `adt init` records no file or the intended key differs, connect it explicitly:

```sh
"$ADT_BIN" connect "<absolute-path-to-file.fmp12-or-fmnet-url>" --name "<file-key>"
```

Tell the user to allow the FileMaker Pro Agent Access prompt if ADT displays one. Confirm the target and access result before proceeding.

## 4. Add the ADT web viewer app

State that the next command may provision ADT-owned FileMaker components and create a new app layout. Then run:

```sh
cd "<absolute-adt-project-path>"
"$ADT_BIN" app add "<kebab-case-app-name>" --file "<file-key>" --non-interactive
cat "webviewer-apps/<kebab-case-app-name>/adt-project-setup-summary.json"
cat "webviewer-apps/<kebab-case-app-name>/AGENTS.md"
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
proofkit-setup-summary.json
proofkit-setup.log
```

Merge `package.json` instead of replacing it:

- keep ADT's `@adt/fmdapi` dependency, `adtMetadata`, Intent configuration, and ADT scripts;
- preserve non-ProofKit dependencies and custom scripts;
- remove `@proofkit/webviewer`, `@proofkit/fmdapi`, and `@proofkit/typegen` only after you map or report every usage;
- keep `deploy: "adt deploy"` and `typegen: "adt typegen"`;
- preserve the source package name only if it remains unique in the ADT workspace.

Rewrite only the supported imports listed in the compatibility table. Preserve the rest for review.

Merge the inner `config` object from `proofkit.config.json` into `adt.config.json`:

- preserve `path`, `clearOldFiles`, `clientSuffix`, `validator`, and `layouts`;
- use `ADT_execute_data_api` as `webviewerScriptName`;
- keep the file binding produced by ADT;
- omit ProofKit-only top-level keys such as `appType`, `ui`, `dataSources`, `envFile`, `registryTemplates`, and `replacedMainPage` after recording any behavior they represented.

Keep the user's Vite configuration and replace only the bridge import and call needed for ADT. Keep the user's UI instead of copying the current ADT starter UI over it.

## 6. Audit the FileMaker boundary without editing scripts

Use ADT's read-only diagnostics first:

```sh
cd "<absolute-adt-project-path>"
"$ADT_BIN" doctor --json
```

For script inventory, run `fm help script` and follow the installed `fm-cli` skill to read scripts from the target recorded in `adt.json`. Use the operation shape shown by live help.

Produce a table with one row per application script call:

| Script called by app | Present in target | Owner | Contract status | Evidence |
|---|---|---|---|---|
| `<name>` | yes/no | ADT/ProofKit/user/unknown | compatible/unverified/incompatible | source location and FileMaker read result |

Mark a script contract `compatible` only after verifying its parameter shape, result shape, callback behavior, and layout navigation requirements. A script that needs an edit remains `unverified` or `incompatible`; report the required FileMaker work and stop that flow.

## 7. Regenerate and verify the ADT app

Install from the ADT workspace root, then verify from the app directory:

```sh
cd "<absolute-adt-project-path>"
pnpm install

cd "webviewer-apps/<kebab-case-app-name>"
"$ADT_BIN" typegen
pnpm fix
pnpm lint
pnpm build
pnpm dev
```

Confirm the dev server prints a local URL and returns HTTP 200. Test only flows with compatible FileMaker script contracts. Stop the dev server after verification.

Typegen must exit zero, but that alone doesn't prove success. Report whether it generated layout client files. If `layouts` is empty, say: `tooling wired, app schema not configured yet`.

## Completion report

Report:

- source and destination paths;
- ADT project, file key, target, and app binding from `adt.json`;
- `adt app add` phase results;
- every dependency/import/config rewrite;
- the FileMaker script compatibility table;
- unresolved FileMaker script or layout work;
- typegen output and whether it generated layout clients;
- lint and build results;
- dev URL verification;
- confirmation that source files, existing FileMaker scripts, and ProofKit components weren't modified or removed.

Call the migration complete only when the app builds and every exercised FileMaker flow has a verified compatible script contract. Otherwise call the project scaffold migrated and list the remaining FileMaker work.
