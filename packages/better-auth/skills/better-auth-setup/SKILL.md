---
name: better-auth-setup
description: >
  Set up self-hosted authentication with better-auth using FileMaker as the
  database backend. Covers FileMakerAdapter, FMServerConnection, betterAuth
  config, migration via npx @proofkit/better-auth migrate, OData prerequisites,
  fmodata privilege, Full Access credentials for schema modification, plugin
  migration workflow, troubleshooting "filemaker is not supported" errors.
metadata:
  type: core
  library: proofkit
  library_version: "0.4.1"
requires:
  - fmodata-client
sources:
  - "proofsh/proofkit:packages/better-auth/src/*.ts"
  - "proofsh/proofkit:apps/docs/content/docs/better-auth/*.mdx"
---

## Setup

### Prerequisites

- OData enabled on FileMaker Server
- API credentials with `fmodata` privilege enabled
- Read/write access to the better-auth tables
- Full Access credentials available for schema migration (can differ from runtime credentials)

### Install packages

```bash
pnpm add @proofkit/better-auth @proofkit/fmodata
```

### Configure auth.ts

```ts
import { betterAuth } from "better-auth";
import { FMServerConnection } from "@proofkit/fmodata";
import { FileMakerAdapter } from "@proofkit/better-auth";

const connection = new FMServerConnection({
  serverUrl: process.env.FM_SERVER_URL!,
  auth: {
    username: process.env.FM_USERNAME!,
    password: process.env.FM_PASSWORD!,
  },
});

const db = connection.database(process.env.FM_DATABASE!);

export const auth = betterAuth({
  database: FileMakerAdapter({ database: db }),
  // add plugins, social providers, etc.
});
```

`FileMakerAdapter` accepts a `FileMakerAdapterConfig`:

- `database` (required) -- an fmodata `Database` instance
- `debugLogs` (optional) -- enable adapter debug logging
- `usePlural` (optional) -- set `true` if table names are plural

The adapter maps Better Auth operations (create, findOne, findMany, update, delete, count) to OData requests via `db._makeRequest`. It does not support JSON columns, native dates, or native booleans -- all values are stored as strings/numbers.

### Alternative: Data API key (OttoFMS 4.11+)

```ts
const connection = new FMServerConnection({
  serverUrl: process.env.FM_SERVER_URL!,
  auth: {
    apiKey: process.env.OTTO_API_KEY!,
  },
});
```

OData must be enabled for the key.

## Core Patterns

### 1. Initial migration

After configuring `auth.ts`, run the migration CLI to create tables and fields in FileMaker:

```bash
npx @proofkit/better-auth migrate
```

The CLI:

1. Loads your `auth.ts` config (auto-detected or via `--config <path>`)
2. Calls `getSchema()` from `better-auth/db` to determine required tables/fields
3. Fetches current OData metadata via `db.getMetadata()`
4. Computes a diff: tables to create, fields to add to existing tables
5. Prints the migration plan and prompts for confirmation
6. Executes via `db.schema.createTable()` and `db.schema.addFields()`

Only schema is modified. No layouts or relationships are created.

If your runtime credentials lack Full Access, override for migration only:

```bash
npx @proofkit/better-auth migrate --username "admin" --password "admin_pass"
```

Skip confirmation with `-y`:

```bash
npx @proofkit/better-auth migrate -y
```

### 2. Adding plugins and re-migrating

When you add a Better Auth plugin (e.g. `twoFactor`, `organization`), it declares additional tables/fields. After updating `auth.ts`:

```ts
import { betterAuth } from "better-auth";
import { twoFactor } from "better-auth/plugins";
import { FMServerConnection } from "@proofkit/fmodata";
import { FileMakerAdapter } from "@proofkit/better-auth";

const connection = new FMServerConnection({
  serverUrl: process.env.FM_SERVER_URL!,
  auth: {
    username: process.env.FM_USERNAME!,
    password: process.env.FM_PASSWORD!,
  },
});

const db = connection.database(process.env.FM_DATABASE!);

export const auth = betterAuth({
  database: FileMakerAdapter({ database: db }),
  plugins: [twoFactor()],
});
```

Re-run migration:

```bash
npx @proofkit/better-auth migrate
```

The planner diffs against existing metadata, so only new tables/fields are added. Existing tables are left untouched.

### 3. Troubleshooting privilege errors

When migration fails with OData error code `207`, the account lacks schema modification privileges. The CLI outputs:

```
Failed to create table "tableName": Cannot modify schema.
The account used does not have schema modification privileges.
Use --username and --password to provide Full Access credentials.
```

Fix: provide Full Access credentials via CLI flags. These are only used for migration, not at runtime.

## Common Mistakes

### [CRITICAL] Using better-auth CLI instead of @proofkit/better-auth

Wrong:
```bash
npx better-auth migrate
```

Correct:
```bash
npx @proofkit/better-auth migrate
```

The standard better-auth CLI does not know about the FileMaker adapter and produces: `ERROR [Better Auth]: filemaker is not supported. If it is a custom adapter, please request the maintainer to implement createSchema`. The `@proofkit/better-auth` CLI loads your auth config, extracts the `Database` instance from the adapter, and handles migration via fmodata's schema API.

Source: `apps/docs/content/docs/better-auth/troubleshooting.mdx`

### [HIGH] Missing Full Access credentials for schema migration

Wrong:
```bash
# Using runtime credentials that only have fmodata privilege
npx @proofkit/better-auth migrate
# Fails with OData error 207: Cannot modify schema
```

Correct:
```bash
npx @proofkit/better-auth migrate --username "full_access_user" --password "full_access_pass"
```

Schema modification (`db.schema.createTable`, `db.schema.addFields`) requires [Full Access] privileges. Standard API accounts with `fmodata` privilege can read/write data but cannot alter schema. The CLI accepts `--username` and `--password` flags to override credentials for migration only.

Source: `packages/better-auth/src/cli/index.ts`, `packages/better-auth/src/migrate.ts`

### [HIGH] Removing fields added by migration

Wrong:
```
Manually deleting "unused" fields from better-auth tables in FileMaker
```

Correct:
```
Keep all fields created by migration, even if you don't plan to use them
```

Better Auth expects all schema fields to exist at runtime. The adapter issues OData requests that reference these fields. Removing them causes runtime errors when Better Auth attempts to read or write those columns.

Source: `apps/docs/content/docs/better-auth/installation.mdx`

### [HIGH] Forgetting to re-run migration after adding plugins

Wrong:
```ts
// Added twoFactor() plugin to auth.ts but did not re-run migration
export const auth = betterAuth({
  database: FileMakerAdapter({ database: db }),
  plugins: [twoFactor()],
});
// Runtime errors: tables/fields for twoFactor don't exist
```

Correct:
```bash
# After adding any plugin to auth.ts, always re-run:
npx @proofkit/better-auth migrate
```

Each plugin declares additional tables and fields via `getSchema()`. The migration planner diffs the full schema (including plugins) against current OData metadata. Without re-running, the new tables/fields don't exist and Better Auth throws at runtime.

Source: `apps/docs/content/docs/better-auth/installation.mdx`

## References

- **fmodata-client** -- Better Auth uses fmodata `Database` under the hood for all OData requests. `FMServerConnection` and `database()` must be configured before `FileMakerAdapter` can work. The adapter calls `db._makeRequest()` for CRUD and `db.schema.*` for migrations.
