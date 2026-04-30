# @proofkit/fmodata

## 0.1.0-beta.42

### Patch Changes

- ee4c951: Preserve caller-supplied `Content-Type` headers so OData batch requests keep their required multipart boundary.

## 0.1.0-beta.41

### Patch Changes

- e229b35: Add configurable database name normalization for OData and webhook requests.

## 0.1.0-beta.40

### Patch Changes

- 638f432: Fix `_makeRequestEffect` unconditionally overwriting the caller-supplied `Accept` header. `getMetadata({ format: "xml" })` was setting `Accept: application/xml` which got clobbered with `application/json`, causing the server to return JSON metadata that was then mis-cast to a string and handed to fast-xml-parser. Now the default Accept is only applied when the caller hasn't specified one. This unblocks `@proofkit/typegen` for fmodata configs.

## 0.1.0-beta.39

### Minor Changes

- 2f0f8f3: Add Claris ID auth support for `fmodata` FileMaker Cloud connections, including CLI and typegen env/config support.
- 7906ee8: Add `ROWID` record locator support to `fmodata` single-record APIs.
  - Allow `db.from(table).get({ ROWID: 2 })`
  - Add `update(data).byRowId(2)`
  - Add `delete().byRowId(2)`

- ac7c9f4: Split the fmodata count API into 2 flows. `db.from(table).count()` now runs a count-only query against the `/$count` endpoint, while `db.from(table).list().count()` keeps the list query and returns `{ records, count }` from a single request. This improves pagination ergonomics and avoids forcing two requests when rows and total count are both needed.

### Patch Changes

- 3d8cd82: Fix `insert()` and `update(..., { returnFullRecord: true })` to preserve merged `Prefer` headers for `fmodata.include-specialcolumns` and `fmodata.entity-ids`, and return special columns in typed full-record mutation responses.
- c0ab6fd: Quote reserved `ID` field names case-insensitively in OData selects and filters.

## 0.1.0-beta.38

### Patch Changes

- b075656: Fix batch sub-request URLs to use canonical FileMaker OData path format. Strips the Otto proxy prefix (`/otto/`) and `.fmp12` file extension from database names in sub-request URLs inside multipart batch bodies, which are processed directly by FileMaker's OData engine. Also fix `InvalidLocationHeaderError` in batch insert/update sub-responses by gracefully handling missing Location headers (returns ROWID -1 instead of throwing).

## 0.1.0-beta.37

### Patch Changes

- e6889d0: Update skill content

## 0.1.0-beta.36

### Patch Changes

- e0a9443: Return structured query errors for invalid entity-id table refs and unresolved filter operands instead of throwing or sending malformed OData filters

## 0.1.0-beta.35

### Patch Changes

- b73b0d7: - cli: Revamp the WebViewer Vite template and harden `proofkit init` (ignore hidden files, improve non-interactive prompts, stop generating Cursor rules).
  - cli: Install typegen skills locally when scaffolding projects.
  - typegen: Add optional `fmMcp` config for using an FM MCP proxy during metadata fetching.
  - fmdapi/fmodata/webviewer: Add initial Codex skills for client and integration workflows.

## 0.1.0-beta.34

### Minor Changes

- ce73357: Add metadata fields subcommand for listing table field names and metadata
  - New `fmodata metadata fields` CLI command to list fields for a specific table
  - Support `--table` option to specify target table (required)
  - Support `--details` flag to include field metadata (type, nullable, etc)
  - Simplifies field inspection workflow vs full metadata export

## 0.1.0-beta.33

### Patch Changes

- 5544f68: - cli: Revamp the WebViewer Vite template and harden `proofkit init` (ignore hidden files, improve non-interactive prompts, stop generating Cursor rules).
  - cli: Install typegen skills locally when scaffolding projects.
  - typegen: Add optional `fmHttp` config for using an FM HTTP proxy during metadata fetching.
  - fmdapi/fmodata/webviewer: Add initial Codex skills for client and integration workflows.
- f3980b1: Add warnings to agent skills to prevent manually adding fields or inventing entity IDs in generated schema files; deduplicate common mistakes across skills with cross-refs to typegen-setup

## 0.1.0-beta.32

### Minor Changes

- 78a9f70: Add CLI binary with commands for records, schema, metadata, scripts, and webhooks
  - New `fmodata` command-line interface for database operations
  - Records command: Query, create, update, delete FileMaker records
  - Schema command: Inspect and manage database schema
  - Metadata command: Access FileMaker metadata and system information
  - Scripts command: Execute FileMaker scripts
  - Webhooks command: Manage webhook subscriptions and configuration

- de21bbe: Add select("all") to override defaultSelect on a per-query basis

### Patch Changes

- 1acca57: Update docs AI agent integration instructions

  Updated quick-start and index docs to reference npx @tanstack/intent@latest instead of npx skills

## 0.1.0-beta.31

### Minor Changes

- c5efdbd: fix(fmodata): align webhook types with actual FM OData API response

  BREAKING: `WebhookListResponse`, `WebhookInfo`, and `WebhookAddResponse` property names changed to match what the API actually returns:
  - `Status` → `status`, `WebHook` → `webhooks`
  - `webHookID` → `webhookID`, `url` → `webhook`
  - `webHookResult` → `webhookResult`

### Patch Changes

- 2cddedf: Fix `getMetadata()` key lookup when FileMaker Server returns the database name without `.fmp12` extension. Upgrade better-auth to 1.5.x (`createAdapter` → `createAdapterFactory`, removed `getAdapter`).

## 0.1.0-beta.29

### Patch Changes

- Allow Date objects as the second parameter for date, time, and timestamp filter operators (eq, ne, gt, gte, lt, lte). Date values are serialized to OData-friendly ISO strings (YYYY-MM-DD for date, HH:mm:ss for time, full ISO 8601 for timestamp).

## 0.1.0-beta.28

### Patch Changes

- 6c6b569: Fix navigate() losing per-table useEntityIds after Database.from() mutation fix

## 0.1.0-beta.27

### Patch Changes

- 840c7c1: Fix unquoted date/time/timestamp values in OData filters and fix `Database.from()` mutating shared `_useEntityIds` state

## 0.1.0-beta.26

### Minor Changes

- 553d386: Add OData string functions: `matchesPattern`, `tolower`, `toupper`, `trim`

## 0.1.0-beta.25

### Patch Changes

- 69fd3fb: BREAKING(@proofkit/better-auth): Use fmodata Database object instead of raw OData config.
  Config now requires `database` (fmodata Database instance) instead of
  `odata: { serverUrl, auth, database }`.
  Enables fetch override via FMServerConnection's fetchClientOptions.

## 0.1.0-beta.24

### Patch Changes

- b727425: Fix navigate() not including parent table in URL when defaultSelect is "schema" or object (#107)

## 0.1.0-beta.23

### Patch Changes

- 863e1e8: Update tooling to Biome

## 0.1.0-beta.22

### Patch Changes

- 4072415: Add `useEntityIds` override parameter to `getQueryString()` methods in QueryBuilder and RecordBuilder, allowing users to override entity ID usage when inspecting query strings without executing requests.

## 0.1.0-beta.21

### Minor Changes

- Beta release

## 0.0.0

Initial setup of the package.
