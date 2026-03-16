---
name: typegen-setup
description: >
  Configure and run @proofkit/typegen to generate TypeScript types and Zod
  validators from FileMaker layouts or OData metadata. Covers
  proofkit-typegen-config.jsonc, validator options (zod/v4, zod/v3),
  generated vs override file structure, envNames, InferTableSchema,
  InferZodPortals, schema/generated/client directory layout, and
  fmHttp mode for local typegen without credentials.
type: core
library: proofkit
library_version: "1.1.0-beta.15"
sources:
  - "proofgeist/proofkit:packages/typegen/src/cli.ts"
  - "proofgeist/proofkit:packages/typegen/src/typegen.ts"
  - "proofgeist/proofkit:packages/typegen/src/fmodata/typegen.ts"
  - "proofgeist/proofkit:apps/docs/content/docs/typegen/*.mdx"
---

## Setup

Install and initialize:

```bash
npx @proofkit/typegen init
```

This creates `proofkit-typegen-config.jsonc` at your project root. Set environment variables:

```bash
FM_SERVER=https://your-server.com
FM_DATABASE=MyFile.fmp12
OTTO_API_KEY=dk_123...abc
```

Add a script to `package.json`:

```json
{
  "scripts": {
    "typegen": "npx @proofkit/typegen"
  }
}
```

Run it:

```bash
npx @proofkit/typegen
```

Generated output structure (assuming `"path": "schema"` with two layouts):

```
schema/
  generated/      # Auto-generated. NEVER edit.
    Customers.ts
    Invoices.ts
  client/         # Auto-generated. NEVER edit.
    Customers.ts
    Invoices.ts
    index.ts
  Customers.ts    # Override file. Safe to edit.
  Invoices.ts     # Override file. Safe to edit.
```

### OData-generated output structure

For OData configs (`"type": "fmodata"`), typegen generates `fmTableOccurrence` definitions:

```text
schema/odata/
  generated/      # Auto-generated. NEVER edit fields or entity IDs.
    Customers.ts  # fmTableOccurrence with fields, entity IDs from FM metadata
    Orders.ts
```

You may add `readValidator`, `writeValidator`, `defaultSelect`, `navigationPaths`, and other options to generated schemas. Do NOT add new fields or change entity IDs (`FMFID`/`FMTID`) — these must come from FileMaker metadata via typegen. Re-run `npx @proofkit/typegen` after any FileMaker schema change.

## Core Patterns

### Data API config

```jsonc
{
  "$schema": "https://proofkit.dev/typegen-config-schema.json",
  "config": {
    "type": "fmdapi",
    "path": "schema",
    "validator": "zod/v4",
    "clientSuffix": "Layout",
    "clearOldFiles": true,
    "generateClient": true,
    "layouts": [
      { "layoutName": "api_Customers", "schemaName": "Customers" },
      {
        "layoutName": "api_Invoices",
        "schemaName": "Invoices",
        "valueLists": "strict",
        "strictNumbers": true
      }
    ]
  }
}
```

Use the generated client:

```ts
import { CustomersLayout } from "./schema/client";

const { data } = await CustomersLayout.list();
```

### OData config

OData configs require `"type": "fmodata"`. Tables replace layouts.

```jsonc
{
  "$schema": "https://proofkit.dev/typegen-config-schema.json",
  "config": {
    "type": "fmodata",
    "path": "schema/odata",
    "reduceMetadata": true,
    "tables": [
      {
        "tableName": "Customers",
        "fields": [
          { "fieldName": "InternalID", "exclude": true },
          { "fieldName": "Status", "typeOverride": "boolean" }
        ]
      },
      { "tableName": "Orders", "variableName": "OrdersTable" }
    ]
  }
}
```

### Override files for customization

Override files live at `schema/<schemaName>.ts`. They re-export from `generated/` and are never overwritten. Customize by modifying the Zod schema:

```ts
// schema/Customers.ts (override file)
import { z } from "zod/v4";
import {
  ZCustomers as ZCustomers_generated,
} from "./generated/Customers";

export const ZCustomers = ZCustomers_generated
  .omit({ active: true })
  .extend({
    active: z.coerce.boolean(),
  });

export type TCustomers = z.infer<typeof ZCustomers>;
```

The generated client automatically imports from the override file, so transformations apply at runtime.

### Type inference helpers

For Data API portals, use `InferZodPortals` from `@proofkit/fmdapi`:

```ts
import type { InferZodPortals } from "@proofkit/fmdapi";

export const ZInvoicesPortals = {
  lineItems: ZLineItems,
};

export type TInvoicesPortals = InferZodPortals<typeof ZInvoicesPortals>;
```

For OData tables, use `InferTableSchema` from `@proofkit/fmodata`:

```ts
import type { InferTableSchema } from "@proofkit/fmodata";
import { Customers } from "./schema/odata/generated/Customers";

type CustomerRow = InferTableSchema<typeof Customers>;
```

### Multiple configs

The `config` key can be an array mixing `fmdapi` and `fmodata` entries, each with its own `path` and `envNames`.

### FM HTTP mode (local development, no credentials)

FM HTTP mode lets typegen fetch layout metadata from a locally running FileMaker file via the FM HTTP proxy, without needing OttoFMS, a hosted server, or any credentials. Generated clients still use `WebViewerAdapter` — FM HTTP is only used during typegen.

```jsonc
{
  "$schema": "https://proofkit.dev/typegen-config-schema.json",
  "config": {
    "type": "fmdapi",
    "fmHttp": { "enabled": true },
    "layouts": [
      { "layoutName": "api_Contacts", "schemaName": "Contacts" }
    ]
  }
}
```

`fmHttp` accepts an object with optional overrides:

- `enabled` — `true` to enable (default when object is present)
- `scriptName` — FM script the proxy calls for Data API operations. Resolution: `fmHttp.scriptName` > `webviewerScriptName` > `"execute_data_api"`
- `baseUrl` — FM HTTP server URL (default: `http://127.0.0.1:1365`). Can also be set via `FM_HTTP_BASE_URL` env var
- `connectedFileName` — FileMaker file name. If omitted, auto-discovered from `GET /connectedFiles` and written back to config

The generated client uses `WebViewerAdapter` with `webviewerScriptName` if set, otherwise `"execute_data_api"`.

**Prerequisites:**
1. FM HTTP daemon running locally (`GET http://127.0.0.1:1365/health` should return OK)
2. FileMaker file open on the local machine
3. "Connect to MCP" script run in the FileMaker file (opens a WebViewer window that bridges HTTP requests)
4. That WebViewer window must stay open in **Browse mode** (not Layout mode)

### Custom env variable names

```jsonc
{
  "config": {
    "type": "fmdapi",
    "envNames": {
      "server": "MY_FM_SERVER",
      "db": "MY_FM_DATABASE",
      "auth": {
        "apiKey": "MY_OTTO_KEY"
      }
    },
    "layouts": [
      { "layoutName": "api_Users", "schemaName": "Users" }
    ]
  }
}
```

Default env variable names when `envNames` is omitted: `FM_SERVER`, `FM_DATABASE`, `OTTO_API_KEY` (or `FM_USERNAME`/`FM_PASSWORD` for Fetch adapter).

## Common Mistakes

### CRITICAL: Editing generated or client directories

Wrong:
```ts
// schema/generated/Customers.ts  <-- editing this file
export const ZCustomers = z.object({
  name: z.string(),
  active: z.coerce.boolean(), // manually added
});
```

Correct:
```ts
// schema/Customers.ts  <-- edit the override file instead
import { ZCustomers as ZCustomers_generated } from "./generated/Customers";

export const ZCustomers = ZCustomers_generated
  .omit({ active: true })
  .extend({ active: z.coerce.boolean() });

export type TCustomers = z.infer<typeof ZCustomers>;
```

Files in `generated/` and `client/` are overwritten on every typegen run; all customizations belong in the override files at the schema root. For OData schemas, do not manually add fields or change entity IDs (`FMFID`/`FMTID`) in generated files — these come from FileMaker metadata. You may safely add `readValidator`, `writeValidator`, `defaultSelect`, `navigationPaths`, and other options.

Source: apps/docs/content/docs/typegen/customization.mdx

### HIGH: Using old config file format

Wrong:
```js
// fmschema.config.mjs
export default {
  schemas: [{ layout: "Customers", schemaName: "Customers" }],
};
```

Correct:
```jsonc
// proofkit-typegen-config.jsonc
{
  "$schema": "https://proofkit.dev/typegen-config-schema.json",
  "config": {
    "type": "fmdapi",
    "layouts": [
      { "layoutName": "Customers", "schemaName": "Customers" }
    ]
  }
}
```

The config migrated from `fmschema.config.mjs` to `proofkit-typegen-config.jsonc` in v5. Run `npx @proofgeist/fmdapi@latest upgrade` to auto-migrate.

Source: apps/docs/content/docs/fmdapi/version-5.mdx

### CRITICAL: Putting env var values instead of names in config

Wrong:
```jsonc
{
  "envNames": {
    "server": "https://my-server.com",
    "auth": {
      "apiKey": "dk_abc123secret"
    }
  }
}
```

Correct:
```jsonc
{
  "envNames": {
    "server": "MY_FM_SERVER",
    "auth": {
      "apiKey": "MY_OTTO_KEY"
    }
  }
}
```

`envNames` expects the names of environment variables (e.g. `"MY_OTTO_KEY"`), not their secret values; typegen reads the actual values from the environment at runtime.

Source: apps/docs/content/docs/typegen/config.mdx

### HIGH: Not running typegen after FileMaker schema changes

Wrong:
```ts
// Manually adding a new field that was added in FileMaker
const ZCustomers = ZCustomers_generated.extend({
  newField: z.string(),
});
```

Correct:
```bash
npx @proofkit/typegen
```

After changing layouts or table schemas in FileMaker, re-run typegen to regenerate types; the generated schemas are the source of truth for field names and types.

Source: packages/typegen/src/typegen.ts

### HIGH: Omitting type discriminator for OData config

Wrong:
```jsonc
{
  "config": {
    "tables": [
      { "tableName": "Customers" }
    ]
  }
}
```

Correct:
```jsonc
{
  "config": {
    "type": "fmodata",
    "tables": [
      { "tableName": "Customers" }
    ]
  }
}
```

Without `"type": "fmodata"`, the config defaults to `"fmdapi"` and expects a `layouts` array instead of `tables`, causing a validation error.

Source: packages/typegen/src/types.ts:238-243

### CRITICAL: Manually redefining types instead of using generated ones

Wrong:
```ts
// Defining types by hand
interface Customer {
  name: string;
  email: string;
  phone: string;
}
```

Correct:
```ts
import type { TCustomers } from "./schema/Customers";
// or for OData:
import type { InferTableSchema } from "@proofkit/fmodata";
import { Customers } from "./schema/odata/generated/Customers";
type CustomerRow = InferTableSchema<typeof Customers>;
```

Hand-written types drift from the database schema; always derive types from typegen output to stay in sync.

Source: packages/typegen/src/buildSchema.ts

### HIGH: Mixing Zod v3 and v4 in the same project

Wrong:
```jsonc
{
  "config": [
    { "type": "fmdapi", "validator": "zod/v4", "layouts": [] },
    { "type": "fmdapi", "validator": "zod/v3", "layouts": [] }
  ]
}
```

Correct:
```jsonc
{
  "config": [
    { "type": "fmdapi", "validator": "zod/v4", "layouts": [] },
    { "type": "fmdapi", "validator": "zod/v4", "layouts": [] }
  ]
}
```

Zod v3 and v4 have incompatible APIs (`z.infer` vs `z.output`, different `extend` behavior); use one version across all configs to avoid runtime conflicts.

Source: apps/docs/content/docs/typegen/config.mdx

### CRITICAL: Using FmHttpAdapter in production application code

Wrong:
```ts
import { FmHttpAdapter } from "@proofkit/fmdapi/adapters/fm-http";

const client = DataApi({
  adapter: new FmHttpAdapter({
    baseUrl: "http://127.0.0.1:1365",
    connectedFileName: "MyFile",
  }),
  layout: "Contacts",
});
```

Correct:
```ts
// Use the typegen-generated client (uses WebViewerAdapter internally)
import { ContactsLayout } from "./schema/client";

const { data } = await ContactsLayout.find({ query: { name: "==John" } });
```

`FmHttpAdapter` is internal to typegen's metadata fetching process. It only runs during code generation, never in production. Generated clients use `WebViewerAdapter` for runtime data access inside FileMaker WebViewer.

### HIGH: Setting standard FM env vars when using fmHttp mode

Wrong:
```bash
# Agent configures both standard and fmHttp vars
FM_SERVER=https://fm.example.com
FM_DATABASE=MyFile.fmp12
OTTO_API_KEY=dk_abc123
FM_HTTP_BASE_URL=http://127.0.0.1:1365
```

Correct:
```bash
# fmHttp mode only — no server/db/auth needed
# baseUrl defaults to http://127.0.0.1:1365 if not set
# connectedFileName is auto-discovered if not set
FM_CONNECTED_FILE_NAME=MyFile
```

fmHttp mode bypasses the standard FM_SERVER/FM_DATABASE/auth env vars entirely. Setting both causes confusion when standard validation reports missing values.

### HIGH: FM HTTP connection failures — troubleshooting

If typegen fails to connect in fmHttp mode, do NOT suggest falling back to OttoFMS or FetchAdapter. The developer chose fmHttp because they don't have hosted credentials or are working with a local-only file.

Troubleshooting checklist:
1. **Daemon running?** `curl http://127.0.0.1:1365/health` — should return `{"service":"fm-http","status":"ok"}`
2. **File connected?** `curl http://127.0.0.1:1365/connectedFiles` — should list the target file
3. **File not listed?** Open the FileMaker file and run the **"Connect to MCP"** script
4. **Still not working?** Ensure the WebViewer window opened by "Connect to MCP" is in **Browse mode**, not Layout mode. Closing this window or switching to Layout mode silently breaks the proxy.

## References

- **fmdapi-client**: Typegen generates the layout-specific clients consumed by `@proofkit/fmdapi`. Override files and `InferZodPortals` bridge typegen output into fmdapi usage.
- **fmodata-client**: Typegen generates `fmTableOccurrence` schemas consumed by `@proofkit/fmodata`. `InferTableSchema` extracts row types from generated table definitions.
