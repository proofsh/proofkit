---
name: getting-started
description: >
  getting started, install, setup, prerequisites, FM_SERVER, FM_DATABASE,
  OTTO_API_KEY, fmrest, fmodata, OttoFMS, typegen, create-proofkit, first
  query, Data API vs OData, pnpm, environment variables, scaffold, new
  project, Node.js, FileMaker server, privileges, https
type: lifecycle
library: proofkit
library_version: "monorepo"
sources:
  - "proofgeist/proofkit:apps/docs/content/docs/cli/guides/getting-started.mdx"
  - "proofgeist/proofkit:apps/docs/content/docs/fmdapi/quick-start.mdx"
  - "proofgeist/proofkit:apps/docs/content/docs/fmodata/quick-start.mdx"
---

## Prerequisites

Before starting a ProofKit project, ensure:

- **Node.js** installed (`node -v` to check)
- **pnpm** installed (`pnpm -v` to check) -- strongly recommended over npm
- **git** installed (`git -v` to check)
- **FileMaker Server 19.6+** accessible via port 443
- **OttoFMS 4.7+** installed on the FM server (4.11+ for API key auth with OData)
- **FileMaker account** with the correct extended privilege:
  - `fmrest` for Data API (`@proofkit/fmdapi`)
  - `fmodata` for OData (`@proofkit/fmodata`)
- **Data API enabled** on the FileMaker server

## Setup

There are two paths: scaffold a full project with `create-proofkit`, or add ProofKit packages to an existing project manually.

### Path A: Scaffold a New Project

```bash
pnpm create proofkit@latest
```

The CLI prompts for:
1. **Project name** -- lowercase, numbers, `_`, `-` only
2. **Project type** -- Web App (Next.js) or FileMaker WebViewer
3. **Server URL** -- must start with `https://`
4. **File selection** -- pick a hosted FileMaker file
5. **Auth** -- select an existing OttoFMS Data API key or enter FM credentials
6. **Layout** -- pick a layout to generate the first schema from

After scaffolding:

```bash
cd <projectName>
pnpm dev
```

The dev server starts at `http://localhost:3000`.

### Path B: Add to an Existing Project (Data API)

1. Install packages:

```bash
pnpm add @proofkit/fmdapi zod
```

2. Set environment variables in `.env`:

```bash
FM_SERVER=https://filemaker.example.com   # must start with https://
FM_DATABASE=filename.fmp12                # must end with .fmp12

# OttoFMS Data API key (recommended)
OTTO_API_KEY=dk_123456...789
# OR username/password
FM_USERNAME=admin
FM_PASSWORD=password
```

3. Create typegen config and generate clients:

```bash
npx @proofkit/typegen
```

Add layouts to `proofkit-typegen.config.jsonc`:

```jsonc
{
  "$schema": "https://proofkit.dev/typegen-config-schema.json",
  "config": {
    "clientSuffix": "Layout",
    "layouts": [
      { "layoutName": "api_customers", "schemaName": "Customers" }
    ],
    "path": "schema",
    "clearOldFiles": true
  }
}
```

Run typegen again to generate:

```bash
npx @proofkit/typegen
```

4. First query:

```ts
import { CustomersLayout } from "./schema/client";

const { data } = await CustomersLayout.findOne({
  query: { id: "==123" },
});

console.log(data.fieldData);
```

### Path C: Add to an Existing Project (OData)

1. Install package:

```bash
pnpm add @proofkit/fmodata
```

2. Set environment variables in `.env`:

```bash
FM_SERVER=https://filemaker.example.com
FM_DATABASE=filename.fmp12

# API key auth (OttoFMS 4.11+)
OTTO_API_KEY=dk_123456...789
# OR username/password
FM_USERNAME=admin
FM_PASSWORD=password
```

3. Create a server connection:

```ts
import { FMServerConnection } from "@proofkit/fmodata";

export const connection = new FMServerConnection({
  serverUrl: process.env.FM_SERVER,
  auth: {
    apiKey: process.env.OTTO_API_KEY,
  },
});
```

4. Generate table schemas with typegen (recommended):

```bash
npx @proofkit/typegen
```

This generates `fmTableOccurrence` definitions with correct field types and entity IDs from FileMaker metadata. Do NOT manually write schema files or invent entity IDs — these must come from typegen.

If typegen is not available, you can define a minimal schema manually (without entity IDs):

```ts
import { fmTableOccurrence, textField, numberField } from "@proofkit/fmodata";

const users = fmTableOccurrence("users", {
  id: textField().primaryKey(),
  username: textField().notNull(),
  email: textField().notNull(),
});
```

5. First query:

```ts
import { connection } from "./connection";
import { users } from "./schema";

const db = connection.database(process.env.FM_DATABASE);

const { data, error } = await db.from(users).list().execute();

if (error) {
  console.error(error);
} else {
  console.log(data);
}
```

### Path D: Local WebViewer Development (FM HTTP — no credentials)

For WebViewer apps running inside FileMaker, you can use FM HTTP mode to generate types from a local FileMaker file without any server credentials.

**Prerequisites:**
- FM HTTP daemon installed and running (`curl http://127.0.0.1:1365/health`)
- FileMaker file open locally with "Connect to MCP" script run

1. Install packages:

```bash
pnpm add @proofkit/fmdapi @proofkit/webviewer zod
```

2. No `.env` file needed for typegen (baseUrl defaults, connectedFileName is auto-discovered). Optionally set "connectedFileName" in the config.fmHttp.connectedFileName to override the auto-discovery.

3. Create typegen config with `fmHttp` enabled:

```jsonc
{
  "$schema": "https://proofkit.dev/typegen-config-schema.json",
  "config": {
    "type": "fmdapi",
    "fmHttp": { "enabled": true },
    "layouts": [
      { "layoutName": "api_Contacts", "schemaName": "Contacts" }
    ],
    "path": "schema"
  }
}
```

4. Run typegen — it auto-discovers the connected file and writes it back to config:

```bash
npx @proofkit/typegen
```

5. First query (runs inside FileMaker WebViewer):

```ts
import { ContactsLayout } from "./schema/client";

const { data } = await ContactsLayout.findOne({
  query: { id: "==123" },
});
```

The generated client uses `WebViewerAdapter` with `"execute_data_api"` as the default script name. No server URL or API keys are needed at runtime — all calls go through the FileMaker script engine.

## Choosing Data API vs OData

| Aspect | Data API (`@proofkit/fmdapi`) | OData (`@proofkit/fmodata`) |
|---|---|---|
| FM privilege | `fmrest` | `fmodata` |
| Query style | FileMaker find syntax (`"==value"`) | Drizzle-like ORM (`eq()`, `and()`) |
| Result pattern | Throws on error | Returns `{ data, error }` (neverthrow) |
| Schema definition | Generated via typegen | Field builders or typegen |
| Session management | Token-based sessions | Stateless per request |
| Best for | Existing FM developers familiar with find syntax | Developers wanting SQL-like ergonomics |

Both paths use `@proofkit/typegen` to generate type-safe schemas from FileMaker layouts.

## Common Mistakes

### [CRITICAL] Missing fmrest or fmodata privilege on FM account

Wrong:
```ts
// Account exists but lacks the fmrest extended privilege
// Data API calls fail with 401 or "not authorized"
const connection = new DataApi({
  auth: { username: "app_user", password: "pass" },
});
```

Correct:
```ts
// Account has fmrest (for Data API) or fmodata (for OData) enabled
// in FileMaker File > Manage > Security > Extended Privileges
const connection = new DataApi({
  auth: { username: "api_user", password: "pass" },
});
```

The Data API requires the `fmrest` extended privilege on the FileMaker account. OData requires the `fmodata` extended privilege. Without the correct privilege, all API calls return authorization errors. Enable via File > Manage > Security > Privilege Sets > Extended Privileges.

Source: `apps/docs/content/docs/cli/guides/getting-started.mdx`

### [HIGH] FM_SERVER without https:// prefix

Wrong:
```bash
FM_SERVER=filemaker.example.com
```

Correct:
```bash
FM_SERVER=https://filemaker.example.com
```

Both `@proofkit/fmdapi` and `@proofkit/fmodata` expect `FM_SERVER` to be a full URL including the `https://` protocol prefix. Without it, requests fail with connection errors or malformed URL exceptions.

Source: `apps/docs/content/docs/fmdapi/quick-start.mdx`

### [MEDIUM] Using npm instead of pnpm for create-proofkit

Wrong:
```bash
npm create proofkit@latest
# or
npx create-proofkit@latest
```

Correct:
```bash
pnpm create proofkit@latest
```

npm may fail during project scaffolding due to dependency resolution differences in the monorepo workspace structure. pnpm is the recommended package manager for ProofKit projects.

Source: `apps/docs/content/docs/cli/guides/getting-started.mdx`

## References

- **typegen-setup** -- After getting started, configure typegen for additional layouts and schemas
- **fmdapi-client** -- Full Data API client usage, methods, and query patterns
- **fmodata-client** -- Full OData client usage, filtering, and CRUD operations
