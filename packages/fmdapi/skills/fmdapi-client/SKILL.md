---
name: fmdapi-client
description: >
  DataApi factory, OttoAdapter (dk_ API key), FetchAdapter (username/password
  with token stores), CRUD methods: list, listAll, find, findOne, findFirst,
  maybeFindFirst, findAll, create, update, delete, get, executeScript,
  containerUpload, Standard Schema validation, portal data access, FileMaker
  Data API, layout-bound clients, schema inference
type: core
library: proofkit
library_version: "5.0.3-beta.1"
requires:
  - typegen-setup
sources:
  - "proofgeist/proofkit:packages/fmdapi/src/client.ts"
  - "proofgeist/proofkit:packages/fmdapi/src/adapters/otto.ts"
  - "proofgeist/proofkit:packages/fmdapi/src/adapters/fetch.ts"
  - "proofgeist/proofkit:apps/docs/content/docs/fmdapi/*.mdx"
---

## Setup

Install the package:

```bash
pnpm add @proofkit/fmdapi
```

If you want the companion `typegen-setup` skill available locally in this project, also install:

```bash
pnpm add -D @proofkit/typegen@*
```

### OttoAdapter (recommended)

Requires [OttoFMS](https://ottofms.com/) installed on the FileMaker Server. No token management needed — the proxy handles sessions.

```ts
import { DataApi, OttoAdapter } from "@proofkit/fmdapi";

const client = DataApi({
  adapter: new OttoAdapter({
    auth: { apiKey: process.env.OTTO_API_KEY as `dk_${string}` },
    db: process.env.FM_DATABASE,
    server: process.env.FM_SERVER, // must start with https://
  }),
  layout: "API_Contacts",
});
```

API keys must start with `dk_` (OttoFMS) or `KEY_` (Otto v3). OttoFMS keys use the default HTTPS port with an `/otto` path prefix. Otto v3 keys use port 3030 by default (configurable via `auth.ottoPort`).

### FetchAdapter (direct Data API)

Authenticates with username/password. Manages Data API session tokens automatically.

```ts
import { DataApi, FetchAdapter } from "@proofkit/fmdapi";

const client = DataApi({
  adapter: new FetchAdapter({
    auth: {
      username: process.env.FM_USERNAME,
      password: process.env.FM_PASSWORD,
    },
    db: process.env.FM_DATABASE,
    server: process.env.FM_SERVER,
    tokenStore: fileTokenStore(), // IMPORTANT for production — see Common Mistakes
  }),
  layout: "API_Contacts",
});
```

### With typegen-generated clients

The recommended path is to use `@proofkit/typegen` to generate layout-specific clients with full type safety and schema validation. The generated client file exports a pre-configured `DataApi` instance per layout:

```ts
import { CustomersLayout } from "./schema/client";

const { data } = await CustomersLayout.findOne({
  query: { id: "==abc123" },
});
// data.fieldData is fully typed with your FM field names
```

## Core Patterns

### CRUD Operations

Every `DataApi` client is bound to a single layout. All methods operate on that layout.

**Find records:**

```ts
// Standard find — returns { data: FMRecord[], dataInfo }
const response = await client.find({
  query: { city: "Portland" },
});

// OR finds — pass an array of query objects
const response = await client.find({
  query: [{ city: "Portland" }, { city: "Seattle" }],
});

// findOne — throws unless exactly 1 record found
const { data } = await client.findOne({
  query: { email: "==user@example.com" },
});

// findFirst — returns first record, throws if none found
const { data } = await client.findFirst({
  query: { status: "Active" },
});

// maybeFindFirst — returns first record or null
const result = await client.maybeFindFirst({
  query: { email: "==user@example.com" },
});

// findAll — auto-paginates through all results (caution with large datasets)
const allRecords = await client.findAll({
  query: { status: "==Active" },
});

// Suppress error on empty result set (FM error 401)
const response = await client.find({
  query: { email: "==nonexistent@example.com" },
  ignoreEmptyResult: true, // returns empty array instead of throwing
});
```

**List records (no find criteria):**

```ts
// list — returns up to 100 records by default
const response = await client.list({
  sort: [{ fieldName: "lastName", sortOrder: "ascend" }],
  limit: 50,
  offset: 1,
});

// listAll — auto-paginates (caution with large datasets)
const allRecords = await client.listAll();
```

**Create:**

```ts
const { recordId, modId } = await client.create({
  fieldData: {
    firstName: "Jane",
    lastName: "Doe",
    email: "jane@example.com",
  },
});
```

**Update:**

```ts
// recordId is FileMaker's internal record ID (from find/list/create responses)
await client.update({
  recordId: 42,
  fieldData: { email: "new@example.com" },
  modId: 5, // optional optimistic locking
});
```

**Delete:**

```ts
await client.delete({ recordId: 42 });
```

**Get by record ID:**

```ts
const response = await client.get({ recordId: 42 });
```

### Script Execution

```ts
// Direct execution
const result = await client.executeScript({
  script: "Process Order",
  scriptParam: JSON.stringify({ orderId: "12345" }),
});
console.log(result.scriptResult); // string returned by Exit Script

// Scripts attached to CRUD operations
const { recordId, scriptResult } = await client.create({
  fieldData: { name: "New Record" },
  script: "After Create Hook",
  "script.param": JSON.stringify({ notify: true }),
  // Also available: script.prerequest, script.presort (and their .param variants)
});
```

### Portal Data

Portal data is returned on every record in the `portalData` property. Each portal row includes its own `recordId` and `modId`.

```ts
// Type-safe portal access with manual types
type TOrderRow = {
  "Orders::orderId": string;
  "Orders::orderDate": string;
  "Orders::total": number;
};
type TPortals = {
  portal_orders: TOrderRow; // key = portal object name on layout
};

const client = DataApi<TContact, TPortals>({
  adapter: new OttoAdapter({ /* ... */ }),
  layout: "API_Contacts",
});

const { data } = await client.find({ query: { id: "==123" } });
for (const row of data) {
  for (const order of row.portalData.portal_orders) {
    console.log(order["Orders::orderId"], order.recordId);
  }
}

// Control portal pagination
const response = await client.list({
  portalRanges: {
    portal_orders: { offset: 1, limit: 10 },
  },
});
```

### Container Upload

```ts
const file = new Blob(["file contents"], { type: "text/plain" });

await client.containerUpload({
  recordId: 42,
  containerFieldName: "photo", // typed to field names if using schema
  file,
  containerFieldRepetition: 1, // optional, defaults to first repetition
});
```

### Schema Validation

> **Note:** Schema validators are typically generated by `@proofkit/typegen`. Manual schemas are only needed for non-typegen setups. If using typegen, customize via override files (see `typegen-setup` skill).

The `schema` option accepts any [Standard Schema](https://standardschema.dev/) compliant validator (Zod, Valibot, ArkType, etc.). When set, every read method validates and transforms each record's `fieldData` (and optionally `portalData`).

```ts
import { z } from "zod/v4";
import { DataApi, OttoAdapter } from "@proofkit/fmdapi";

const ZContact = z.object({
  firstName: z.string(),
  lastName: z.string(),
  active: z.coerce.boolean(), // transform FM number to boolean
});

const client = DataApi({
  adapter: new OttoAdapter({ /* ... */ }),
  layout: "API_Contacts",
  schema: {
    fieldData: ZContact,
    // portalData: { portal_orders: ZOrderRow }, // optional
  },
});

// data.fieldData.active is now boolean, not number
const { data } = await client.findFirst({ query: { id: "==123" } });
```

If validation fails, the client throws with details about which fields mismatched. This catches FileMaker field renames at runtime before they corrupt downstream logic.

## Common Mistakes

### CRITICAL: Creating DataApi without an adapter

Wrong:
```ts
import { DataApi } from "@proofkit/fmdapi";

const client = DataApi({
  layout: "Contacts",
  server: "https://fm.example.com",
  db: "MyDB.fmp12",
  auth: { apiKey: "dk_abc123" },
});
```

Correct:
```ts
import { DataApi, OttoAdapter } from "@proofkit/fmdapi";

const client = DataApi({
  adapter: new OttoAdapter({
    server: "https://fm.example.com",
    db: "MyDB.fmp12",
    auth: { apiKey: "dk_abc123" as `dk_${string}` },
  }),
  layout: "Contacts",
});
```

v5 requires an explicit adapter instance. Connection config (`server`, `db`, `auth`) goes on the adapter, not `DataApi`. `layout` goes on `DataApi`.

### CRITICAL: Omitting token store in production (FetchAdapter)

Wrong:
```ts
const client = DataApi({
  adapter: new FetchAdapter({
    auth: { username: "admin", password: "pass" },
    db: "MyDB.fmp12",
    server: "https://fm.example.com",
    // no tokenStore — defaults to in-memory
  }),
  layout: "Contacts",
});
```

Correct:
```ts
import { fileTokenStore } from "@proofkit/fmdapi/tokenStore/file";
// or for serverless:
// import { upstashTokenStore } from "@proofkit/fmdapi/tokenStore/upstash";

const client = DataApi({
  adapter: new FetchAdapter({
    auth: { username: "admin", password: "pass" },
    db: "MyDB.fmp12",
    server: "https://fm.example.com",
    tokenStore: fileTokenStore(),
  }),
  layout: "Contacts",
});
```

Default `memoryStore` loses tokens on process restart, creating a new session each time. FileMaker allows max 500 concurrent sessions — serverless/edge deployments exhaust this quickly. Use `fileTokenStore()` for persistent servers or `upstashTokenStore()` for edge/serverless. OttoAdapter avoids this entirely.

### HIGH: Storing FM recordId as a persistent identifier

Wrong:
```ts
// Saving recordId to your own database as a foreign key
const { recordId } = await client.create({ fieldData: { name: "Acme" } });
await myDb.insert({ fmRecordId: recordId }); // fragile!
```

Correct:
```ts
// Use a stable primary key field (e.g., UUID) from FileMaker
const { data } = await client.findOne({ query: { name: "Acme" } });
const stableId = data.fieldData.primaryKey; // UUID set by auto-enter
```

FileMaker's internal `recordId` can change during imports, migrations, or file recovery. Always use a dedicated primary key field (UUID or serial) for cross-system references. Only use `recordId` for immediate operations (update/delete) within the same request flow.

### HIGH: Assuming dynamic layout switching on a single client

Wrong:
```ts
const client = DataApi({
  adapter: new OttoAdapter({ /* ... */ }),
  layout: "Contacts",
});
// Trying to query a different layout
await client.find({ layout: "Invoices", query: { status: "Open" } });
```

Correct:
```ts
const contactsClient = DataApi({
  adapter: new OttoAdapter({ /* ... */ }),
  layout: "Contacts",
});
const invoicesClient = DataApi({
  adapter: new OttoAdapter({ /* ... */ }),
  layout: "Invoices",
});
```

Each `DataApi` client is bound to one layout at creation. v5 removed per-method layout override. Create a separate client per layout. The adapter instance can be shared.

### MEDIUM: Using wrong Otto API key format

Wrong:
```ts
new OttoAdapter({
  auth: { apiKey: "abc123-def456" }, // no prefix
  db: "MyDB.fmp12",
  server: "https://fm.example.com",
});
```

Correct:
```ts
new OttoAdapter({
  auth: { apiKey: "dk_abc123def456" as `dk_${string}` },
  db: "MyDB.fmp12",
  server: "https://fm.example.com",
});
```

OttoFMS keys start with `dk_`, Otto v3 keys start with `KEY_`. The adapter uses this prefix to determine the connection method (port 3030 for `KEY_`, `/otto` path prefix for `dk_`). An unrecognized prefix throws at construction time.

### HIGH: Using deprecated zodValidators option instead of schema

Wrong:
```ts
import { z } from "zod";

const client = DataApi({
  adapter: new OttoAdapter({ /* ... */ }),
  layout: "Contacts",
  zodValidators: {
    fieldData: z.object({ name: z.string() }),
  },
});
```

Correct:
```ts
import { z } from "zod/v4";

const client = DataApi({
  adapter: new OttoAdapter({ /* ... */ }),
  layout: "Contacts",
  schema: {
    fieldData: z.object({ name: z.string() }),
  },
});
```

`zodValidators` was removed in v5. Use `schema` instead, which accepts any Standard Schema compliant validator. If upgrading from v4, re-run `npx @proofkit/typegen` to regenerate clients with the new option. The client throws at runtime if `zodValidators` is passed.

### CRITICAL: Manually redefining TypeScript types instead of generated types

Wrong:
```ts
// Hand-writing types that duplicate your FM layout
type Contact = {
  firstName: string;
  lastName: string;
  email: string;
};
const client = DataApi<Contact>({
  adapter: new OttoAdapter({ /* ... */ }),
  layout: "API_Contacts",
});
```

Correct:
```ts
// Use typegen-generated client which includes schema + types
import { ContactsLayout } from "./schema/client";

const { data } = await ContactsLayout.find({ query: { email: "==test@example.com" } });
```

Manual types drift when FileMaker fields change, with no runtime protection. The typegen-generated client bundles a Standard Schema validator that catches field renames at runtime. Run `npx @proofkit/typegen` after any layout change. See `typegen-setup` skill for more details.

### HIGH: Mixing Zod v3 and v4 in the same project

Wrong:
```ts
import { z } from "zod"; // v3
import { z as z4 } from "zod/v4"; // v4 in another file

// Both installed, schemas from different versions passed to DataApi
```

Correct:
```ts
// Use one version consistently. v5 typegen generates zod/v4 imports.
import { z } from "zod/v4";
```

Zod v3 and v4 have different Standard Schema implementations. Mixing them causes subtle type mismatches and potential runtime validation failures. The typegen tool generates `zod/v4` imports by default. See `typegen-setup` skill for more details.

## References

- **typegen-setup** -- type generation and client scaffolding that produces the layout-specific clients referenced above
- **fmodata-client** -- alternative ORM-style client using the OData API (Drizzle-like query builder, different from the REST-based Data API covered here)
