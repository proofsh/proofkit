---
name: typegen-fmdapi
description: >
  ENTRY POINT for @proofkit/fmdapi projects. Generate TypeScript types and Zod
  validators from FileMaker layouts using @proofkit/typegen. Covers
  proofkit-typegen-config.jsonc for Data API mode, npx @proofkit/typegen setup,
  OttoAdapter and FetchAdapter env vars, FM MCP mode for local Web Viewer
  development, generated vs override file structure, schema/generated/client
  directory layout, Standard Schema validation, InferZodPortals, fmMcp mode
  prerequisites, and choosing between OttoAdapter and FetchAdapter auth.
metadata:
  type: core
  library: proofkit
  library_version: "5.2.1"
sources:
  - "proofsh/proofkit:packages/typegen/src/cli.ts"
  - "proofsh/proofkit:packages/typegen/src/typegen.ts"
  - "proofsh/proofkit:apps/docs/content/docs/typegen/*.mdx"
  - "proofsh/proofkit:apps/docs/content/docs/fmdapi/quick-start.mdx"
---

> **ALWAYS use `@proofkit/typegen` to set up an @proofkit/fmdapi project.**
> Typegen generates type-safe, schema-validated clients directly from your
> FileMaker layouts. It is the preferred and recommended path — manual client
> setup is only a fallback. Before writing any DataApi code, run typegen first.

## Prerequisites

- **FileMaker Server 19.6+** accessible via port 443
- **OttoFMS 4.7+** installed on the FM server (for API key auth)
- **FileMaker account** with the `fmrest` extended privilege enabled
- **Data API enabled** on the FileMaker server

## Setup

### 1. Install the runtime package

```bash
pnpm add @proofkit/fmdapi
```

### 2. Set environment variables

```bash
# .env
FM_SERVER=https://your-server.com     # must start with https://
FM_DATABASE=MyFile.fmp12              # must end with .fmp12

# OttoFMS Data API key (recommended)
OTTO_API_KEY=dk_123456...789
# OR username/password (requires token store in production)
FM_USERNAME=admin
FM_PASSWORD=password
```

### 3. Initialize and run typegen

```bash
npx @proofkit/typegen@beta init
```

This creates `proofkit-typegen-config.jsonc` at your project root. Configure your layouts:

```jsonc
{
  "$schema": "https://proofkit.proof.sh/typegen-config-schema.json",
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

Run typegen to generate clients:

```bash
npx @proofkit/typegen@beta
```

Add a convenience script to `package.json`:

```json
{
  "scripts": {
    "typegen": "npx @proofkit/typegen@beta"
    "typegen:ui": "npm run typegen ui"
  }
}
```

### 4. First query

```ts
import { CustomersLayout } from "./schema/client";

const { data } = await CustomersLayout.findOne({
  query: { id: "==123" },
});

console.log(data.fieldData);
```

The generated client includes full type safety and runtime schema validation — no manual type definitions needed.

## Core Patterns

### Generated output structure

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

### Override files for customization

Override files live at `schema/<schemaName>.ts`. They re-export from `generated/` and are never overwritten by typegen. Customize by modifying the Zod schema:

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

For portals, use `InferZodPortals` from `@proofkit/fmdapi`:

```ts
import type { InferZodPortals } from "@proofkit/fmdapi";

export const ZInvoicesPortals = {
  lineItems: ZLineItems,
};

export type TInvoicesPortals = InferZodPortals<typeof ZInvoicesPortals>;
```

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

### Multiple configs

The `config` key can be an array mixing `fmdapi` and `fmodata` entries, each with its own `path` and `envNames`.

### FM MCP mode (local Web Viewer development — no credentials)

FM MCP mode lets typegen fetch layout metadata from a locally running FileMaker file via the FM MCP proxy, without needing OttoFMS, a hosted server, or any credentials. Generated clients use `WebViewerAdapter` — FM MCP is only used during typegen.

```jsonc
{
  "$schema": "https://proofkit.proof.sh/typegen-config-schema.json",
  "config": {
    "type": "fmdapi",
    "fmMcp": { "enabled": true },
    "layouts": [
      { "layoutName": "api_Contacts", "schemaName": "Contacts" }
    ]
  }
}
```

`fmMcp` accepts an object with optional overrides:

- `enabled` — `true` to enable (default when object is present)
- `scriptName` — FM script the proxy calls for Data API operations. Resolution: `fmMcp.scriptName` > `webviewerScriptName` > `"PK_execute_data_api"`
- `baseUrl` — FM MCP server URL (default: `http://127.0.0.1:1365`). Can also be set via `FM_HTTP_BASE_URL` env var
- `connectedFileName` — FileMaker file name. If omitted, auto-discovered from `GET /connectedFiles` and written back to config

The generated client uses `WebViewerAdapter` with `webviewerScriptName` if set, otherwise `"PK_execute_data_api"`.

**Prerequisites:**
1. FM MCP daemon running locally (`GET http://127.0.0.1:1365/health` should return OK)
2. FileMaker file open on the local machine
3. "Connect to MCP" script run in the FileMaker file (opens a Web Viewer window that bridges HTTP requests)
4. That Web Viewer window must stay open in **Browse mode** (not Layout mode)

No `.env` file needed for typegen in fmMcp mode — baseUrl defaults, connectedFileName is auto-discovered.

## Common Mistakes

### CRITICAL: Manually redefining TypeScript types instead of using typegen

Wrong:
```ts
// Hand-writing types that duplicate your FM layout
interface Customer {
  name: string;
  email: string;
  phone: string;
}
const client = DataApi<Customer>({
  adapter: new OttoAdapter({ /* ... */ }),
  layout: "API_Contacts",
});
```

Correct:
```bash
# Generate types and clients from FileMaker
npx @proofkit/typegen@beta
```
```ts
// Use the generated client
import { ContactsLayout } from "./schema/client";

const { data } = await ContactsLayout.find({ query: { email: "==test@example.com" } });
```

Hand-written types drift when FileMaker fields change, with no runtime protection. The typegen-generated client bundles a Standard Schema validator that catches field renames at runtime.

Source: packages/typegen/src/buildSchema.ts

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

Files in `generated/` and `client/` are overwritten on every typegen run; all customizations belong in the override files at the schema root.

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
  "$schema": "https://proofkit.proof.sh/typegen-config-schema.json",
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
npx @proofkit/typegen@beta
```

After changing layouts in FileMaker, re-run typegen to regenerate types; the generated schemas are the source of truth for field names and types.

Source: packages/typegen/src/typegen.ts

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

### CRITICAL: Using FmMcpAdapter in production application code

Wrong:
```ts
import { FmMcpAdapter } from "@proofkit/fmdapi/adapters/fm-mcp";

const client = DataApi({
  adapter: new FmMcpAdapter({
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

`FmMcpAdapter` is internal to typegen's metadata fetching process. It only runs during code generation, never in production. Generated clients use `WebViewerAdapter` for runtime data access inside FileMaker Web Viewer.

### HIGH: Setting standard FM env vars when using fmMcp mode

Wrong:
```bash
# Agent configures both standard and fmMcp vars
FM_SERVER=https://fm.example.com
FM_DATABASE=MyFile.fmp12
OTTO_API_KEY=dk_abc123
FM_HTTP_BASE_URL=http://127.0.0.1:1365
```

Correct:
```bash
# fmMcp mode only — no server/db/auth needed
# baseUrl defaults to http://127.0.0.1:1365 if not set
# connectedFileName is auto-discovered if not set
FM_CONNECTED_FILE_NAME=MyFile
```

fmMcp mode bypasses the standard FM_SERVER/FM_DATABASE/auth env vars entirely. Setting both causes confusion when standard validation reports missing values.

### HIGH: FM MCP connection failures — troubleshooting

If typegen fails to connect in fmMcp mode, do NOT suggest falling back to OttoFMS or FetchAdapter. The developer chose fmMcp because they don't have hosted credentials or are working with a local-only file.

Troubleshooting checklist:
1. **Daemon running?** `curl http://127.0.0.1:1365/health` — should return `{"service":"fm-mcp","status":"ok"}`
2. **File connected?** `curl http://127.0.0.1:1365/connectedFiles` — should list the target file
3. **File not listed?** Open the FileMaker file and run the **"Connect to MCP"** script
4. **Still not working?** Ensure the Web Viewer window opened by "Connect to MCP" is in **Browse mode**, not Layout mode. Closing this window or switching to Layout mode silently breaks the proxy.

### CRITICAL: FM_SERVER without https:// prefix

Wrong:
```bash
FM_SERVER=filemaker.example.com
```

Correct:
```bash
FM_SERVER=https://filemaker.example.com
```

`@proofkit/fmdapi` expects `FM_SERVER` to be a full URL including the `https://` protocol prefix. Without it, requests fail with connection errors or malformed URL exceptions.

Source: apps/docs/content/docs/fmdapi/quick-start.mdx

### CRITICAL: Missing fmrest privilege on FM account

The Data API requires the `fmrest` extended privilege on the FileMaker account. Without it, all API calls return authorization errors. Enable via File > Manage > Security > Privilege Sets > Extended Privileges.

Source: apps/docs/content/docs/cli/guides/getting-started.mdx

## References

- **fmdapi-client**: After generating clients with typegen, see the fmdapi-client skill for full CRUD method usage, adapter configuration, portal data, and script execution patterns.
- **webviewer-integration**: For Web Viewer projects using FM MCP mode, the webviewer-integration skill covers fmFetch, callFMScript, and WebViewerAdapter runtime usage.
