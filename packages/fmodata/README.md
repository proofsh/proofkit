# @proofkit/fmodata Documentation

A strongly-typed FileMaker OData API client.

⚠️ This library is in **beta** status. The core API is stable but may still see minor changes before 1.0. Feedback is welcome on the [community forum](https://community.ottomatic.cloud/c/proofkit/13) or on [GitHub](https://github.com/proofsh/proofkit/issues).

Roadmap:

- [ ] Crossjoin support
- [x] Batch operations
  - [ ] Automatically chunk requests into smaller batches (e.g. max 512 inserts per batch)
- [x] Schema updates (add/update tables and fields)
- [x] Proper docs at proofkit.dev
- [x] @proofkit/typegen integration

## Installation

```bash
pnpm add @proofkit/fmodata@beta
```

## Quick Start

Here's a minimal example to get you started:

```typescript
import {
  FMServerConnection,
  fmTableOccurrence,
  textField,
  numberField,
  eq,
} from "@proofkit/fmodata";
import { z } from "zod/v4";

// 1. Create a connection to the server
const connection = new FMServerConnection({
  serverUrl: "https://your-server.com",
  auth: {
    // OttoFMS API key
    apiKey: "your-api-key",

    // or Claris ID for FileMaker Cloud
    // clarisId: {
    //   username: "your@claris-id.com",
    //   password: "password",
    // },

    // or username and password
    // username: "admin",
    // password: "password",
  },
});

// 2. Define your table schema using field builders
const users = fmTableOccurrence("users", {
  id: textField().primaryKey(),
  username: textField().notNull(),
  email: textField().notNull(),
  active: numberField()
    .readValidator(z.coerce.boolean())
    .writeValidator(z.boolean().transform((v) => (v ? 1 : 0))),
});

// 3. Create a database instance
const db = connection.database("MyDatabase.fmp12");

// 4. Query your data
const { data, error } = await db.from(users).list().execute();

if (error) {
  console.error(error);
  return;
}

if (data) {
  console.log(data); // Array of users, properly typed
}
```

## Core Concepts

This library relies heavily on the builder pattern for defining your queries and operations. Most operations require a final call to `execute()` to send the request to the server. The builder pattern allows you to build complex queries and also supports batch operations, allowing you to execute multiple operations in a single request as supported by the FileMaker OData API. It's also helpful for testing the library, as you can call `getQueryString()` to get the OData query string without executing the request.

As such, there are layers to the library to help you build your queries and operations.

- `FMServerConnection` - hold server connection details and authentication
- `FMTable` (created via `fmTableOccurrence()`) - defines the fields, validators, and metadata for a table occurrence
- `Database` - connects the table occurrences to the server connection

### FileMaker Server prerequisites

To use this library you need:

- OData service enabled on your FileMaker server
- A FileMaker account with `fmodata` privilege enabled
- (if using OttoFMS) a Data API key setup for your FileMaker account with OData enabled

A note on best practices:

OData relies entirely on the table occurances in the relationship graph for data access. Relationships between table occurrences are also used, but maybe not as you expect (in short, only the simplest relationships are supported). Given these constraints, it may be best for you to have a seperate FileMaker file for your OData connection, using external data sources to link to your actual data file. We've found this especially helpful for larger projects that have very large graphs with lots of redundant table occurances compared to actual number of base tables.

### Server Connection

The client can authenticate using username/password, Otto API key, or Claris ID for FileMaker Cloud:

```typescript
// Username and password authentication
const connection = new FMServerConnection({
  serverUrl: "https://api.example.com",
  auth: {
    username: "test",
    password: "test",
  },
});

// API key authentication
const connection = new FMServerConnection({
  serverUrl: "https://api.example.com",
  auth: {
    apiKey: "your-api-key",
  },
});

// Claris ID authentication for FileMaker Cloud
const connection = new FMServerConnection({
  serverUrl: "https://your-filemaker-cloud-host.com",
  auth: {
    clarisId: {
      username: "your@claris-id.com",
      password: "password",
    },
  },
});
```

Notes for Claris ID auth:

- Use a Claris ID account, not an external IdP account.
- Tokens are managed internally and refreshed automatically.
- Claris ID tokens are valid for about one hour.
- MFA is not supported.

### Schema Definitions

This library relies on a schema-first approach for good type-safety and optional runtime validation. Use **`fmTableOccurrence()`** with field builders to create your schemas. This provides full TypeScript type inference for field names in queries.

#### Field Builders

Field builders provide a fluent API for defining table fields with type-safe metadata. These field types map directly to the FileMaker field types

- `textField()`
- `numberField()`
- `dateField()`
- `timeField()`
- `timestampField()`
- `containerField()`
- `calcField()`

Each field builder supports chainable methods:

- `.primaryKey()` - Mark as primary key (automatically read-only)
- `.notNull()` - Make field non-nullable (required for inserts)
- `.readOnly()` - Exclude from insert/update operations
- `.entityId(id)` - Assign FileMaker field ID (FMFID), allowing your API calls to survive FileMaker name changes
- `.readValidator(validator)` - Transform/validate data when reading from database
- `.writeValidator(validator)` - Transform/validate data when writing to database

#### Defining Tables

Use `fmTableOccurrence()` to define a table with field builders:

```typescript
import { z } from "zod/v4";
import {
  fmTableOccurrence,
  textField,
  numberField,
  timestampField,
} from "@proofkit/fmodata";

const contacts = fmTableOccurrence(
  "contacts",
  {
    id: textField().primaryKey().entityId("FMFID:1"),
    name: textField().notNull().entityId("FMFID:2"),
    email: textField().notNull().entityId("FMFID:3"),
    phone: textField().entityId("FMFID:4"), // Optional (nullable by default)
    createdAt: timestampField().readOnly().entityId("FMFID:5"),
  },
  {
    entityId: "FMTID:100", // Optional: FileMaker table occurrence ID
    defaultSelect: "schema", // Optional: "all", "schema", or function. Defaults to "schema".
    navigationPaths: ["users"], // Optional: valid navigation targets to provide type-errors when navigating/expanding
  },
);
```

The function returns a table object that provides:

- Column references for each field (e.g., `contacts.id`, `contacts.name`)
- Type-safe schema for queries and operations
- Metadata stored via Symbols (hidden from IDE autocomplete)

#### Default Field Selection

FileMaker will automatically return all non-container fields from a schema if you don't specify a $select parameter in your query. This library allows you to configure default field selection behavior using the `defaultSelect` option:

```typescript
// Option 1 (default): "schema" - Select all fields from the schema
const users = fmTableOccurrence(
  "users",
  {
    /* fields */
  },
  {
    defaultSelect: "schema", // A $select parameter will always be added for only the fields defined in the schema
  },
);

// Option 2: "all" - Select all fields (FileMaker default behavior)
const users = fmTableOccurrence(
  "users",
  {
    /* fields */
  },
  {
    defaultSelect: "all", // No $select parameter by default; FileMaker returns all non-container fields
  },
);

// Option 3: Function - Select specific columns by default
const users = fmTableOccurrence(
  "users",
  {
    /* fields */
  },
  {
    defaultSelect: (cols) => ({
      username: cols.username,
      email: cols.email,
    }), // Only select these fields by default
  },
);

// When you call list() or get(), the defaultSelect is applied automatically
const result = await db.from(users).list().execute();
// If defaultSelect is a function returning { username, email }, result.data will only contain those fields

// You can still override with explicit select()
const result = await db
  .from(users)
  .list()
  .select({ username: users.username, email: users.email, age: users.age }) // Always overrides at the per-request level
  .execute();
```

## Querying Data

### Basic Queries

Use `list()` to retrieve multiple records:

```typescript
// Get all users
const result = await db.from("users").list().execute();

if (result.data) {
  result.data.forEach((user) => {
    console.log(user.username);
  });
}
```

Get a specific record by ID:

```typescript
const result = await db.from("users").get("user-123").execute();

if (result.data) {
  console.log(result.data.username);
}
```

Get a specific record by `ROWID`:

```typescript
const result = await db.from(users).get({ ROWID: 2 }).execute();

if (result.data) {
  console.log(result.data.username);
}
```

Get a single field value:

```typescript
const result = await db
  .from(users)
  .get("user-123")
  .getSingleField(users.email)
  .execute();

if (result.data) {
  console.log(result.data); // "user@example.com"
}
```

### Filtering

fmodata provides type-safe filter operations that prevent common errors at compile time. You can use either the new ORM-style API with operators and column references, or the legacy filter API.

#### New ORM-Style API (Recommended)

Use the `where()` method with filter operators and column references for type-safe filtering:

```typescript
import { eq, gt, and, or, contains } from "@proofkit/fmodata";

// Simple equality
const result = await db
  .from(users)
  .list()
  .where(eq(users.active, true))
  .execute();

// Comparison operators
const result = await db.from(users).list().where(gt(users.age, 18)).execute();

// String operators
const result = await db
  .from(users)
  .list()
  .where(contains(users.name, "John"))
  .execute();

// Combine with AND
const result = await db
  .from(users)
  .list()
  .where(and(eq(users.active, true), gt(users.age, 18)))
  .execute();

// Combine with OR
const result = await db
  .from(users)
  .list()
  .where(or(eq(users.role, "admin"), eq(users.role, "moderator")))
  .execute();
```

Available operators:

- **Comparison**: `eq()`, `ne()`, `gt()`, `gte()`, `lt()`, `lte()`
- **String**: `contains()`, `startsWith()`, `endsWith()`
- **Array**: `inArray()`, `notInArray()`
- **Null**: `isNull()`, `isNotNull()`
- **Logical**: `and()`, `or()`, `not()`

### Sorting

Sort results using `orderBy()`. The method supports both column references (new ORM API) and string field names (legacy API).

#### Using Column References (New ORM API)

```typescript
import { asc, desc } from "@proofkit/fmodata";

// Single field (ascending by default)
const result = await db.from(users).list().orderBy(users.name).execute();

// Single field with explicit direction
const result = await db.from(users).list().orderBy(asc(users.name)).execute();
const result = await db.from(users).list().orderBy(desc(users.age)).execute();

// Multiple fields (variadic)
const result = await db
  .from(users)
  .list()
  .orderBy(asc(users.lastName), desc(users.firstName))
  .execute();

// Multiple fields (array syntax)
const result = await db
  .from(users)
  .list()
  .orderBy([
    [users.lastName, "asc"],
    [users.firstName, "desc"],
  ])
  .execute();
```

#### Type Safety

For typed databases, `orderBy()` provides full type safety:

```typescript
// ✅ Valid - "name" is a field in the schema
db.from(users).list().orderBy(users.name);

// ✅ Valid - tuple with field and direction
db.from(users).list().orderBy(asc(users.name));
db.from(users).list().orderBy(desc(users.name));

// ✅ Valid - multiple fields
db.from(users).list().orderBy(asc(users.lastName), desc(users.firstName));
```

### Pagination

Control the number of records returned and pagination:

```typescript
// Limit results
const result = await db.from(users).list().top(10).execute();

// Skip records (pagination)
const result = await db.from(users).list().top(10).skip(20).execute();

// Count total records without fetching rows
const total = await db.from(users).count().execute();

// Fetch a page of rows and the total count in one request
const page = await db.from(users).list().top(10).skip(20).count().execute();
```

### Selecting Fields

Select specific fields to return. You can use either column references (new ORM API) or string field names (legacy API):

```typescript
// New ORM API: Using column references (type-safe, supports renaming)
const result = await db
  .from(users)
  .list()
  .select({
    username: users.username,
    email: users.email,
    userId: users.id, // Renamed from "id" to "userId"
  })
  .execute();

// result.data[0] will only have username and email fields
```

### Single Records

Use `single()` to ensure exactly one record is returned (returns an error if zero or multiple records are found):

```typescript
const result = await db
  .from(users)
  .list()
  .where(eq(users.email, "user@example.com"))
  .single()
  .execute();

if (result.data) {
  // result.data is a single record, not an array
  console.log(result.data.username);
}
```

Use `maybeSingle()` when you want at most one record (returns `null` if no record is found, returns an error if multiple records are found):

```typescript
const result = await db
  .from(users)
  .list()
  .where(eq(users.email, "user@example.com"))
  .maybeSingle()
  .execute();

if (result.data) {
  // result.data is a single record or null
  console.log(result.data?.username);
} else {
  // No record found - result.data would be null
  console.log("User not found");
}
```

**Difference between `single()` and `maybeSingle()`:**

- `single()` - Requires exactly one record. Returns an error if zero or multiple records are found.
- `maybeSingle()` - Allows zero or one record. Returns `null` if no record is found, returns an error only if multiple records are found.

### Chaining Methods

All query methods can be chained together:

```typescript
// Using new ORM API
const result = await db
  .from(users)
  .list()
  .select({
    username: users.username,
    email: users.email,
    age: users.age,
  })
  .where(gt(users.age, 18))
  .orderBy(asc(users.username))
  .top(10)
  .skip(0)
  .execute();
```

## CRUD Operations

### Insert

Insert new records with type-safe data:

```typescript
// Insert a new user
const result = await db
  .from(users)
  .insert({
    username: "johndoe",
    email: "john@example.com",
    active: true,
  })
  .execute();

if (result.data) {
  console.log("Created user:", result.data);
}
```

Fields are automatically required for insert if they use `.notNull()`. Read-only fields (including primary keys) are automatically excluded:

```typescript
const users = fmTableOccurrence("users", {
  id: textField().primaryKey(), // Auto-required, but excluded from insert (primaryKey)
  username: textField().notNull(), // Auto-required (notNull)
  email: textField().notNull(), // Auto-required (notNull)
  phone: textField(), // Optional by default (nullable)
  createdAt: timestampField().readOnly(), // Excluded from insert/update
});

// TypeScript enforces: username and email are required
// TypeScript excludes: id and createdAt cannot be provided
const result = await db
  .from(users)
  .insert({
    username: "johndoe",
    email: "john@example.com",
    phone: "+1234567890", // Optional
  })
  .execute();
```

### Update

Update records by ID or filter:

```typescript
// Update by ID
const result = await db
  .from(users)
  .update({ username: "newname" })
  .byId("user-123")
  .execute();

if (result.data) {
  console.log(`Updated ${result.data.updatedCount} record(s)`);
}

// Update by ROWID
const byRowId = await db
  .from(users)
  .update({ username: "newname" })
  .byRowId(2)
  .execute();

// Update by filter (using new ORM API)
import { lt, and, eq } from "@proofkit/fmodata";

const result = await db
  .from(users)
  .update({ active: false })
  .where(lt(users.lastLogin, "2023-01-01"))
  .execute();

// Complex filter example
const result = await db
  .from(users)
  .update({ active: false })
  .where(and(eq(users.active, true), lt(users.count, 5)))
  .execute();

// Update with additional query options (legacy filter API)
const result = await db
  .from("users")
  .update({ active: false })
  .where((q) => q.where(eq(users.active, true)).top(10))
  .execute();
```

### Delete

Delete records by ID or filter:

```typescript
// Delete by ID
const result = await db.from(users).delete().byId("user-123").execute();

if (result.data) {
  console.log(`Deleted ${result.data.deletedCount} record(s)`);
}

// Delete by ROWID
const byRowId = await db.from(users).delete().byRowId(2).execute();

// Delete by filter (using new ORM API)
import { eq, and, lt } from "@proofkit/fmodata";

const result = await db
  .from(users)
  .delete()
  .where(eq(users.active, false))
  .execute();

// Delete with complex filters
const result = await db
  .from(users)
  .delete()
  .where(and(eq(users.active, false), lt(users.lastLogin, "2023-01-01")))
  .execute();
```

## Navigation & Relationships

### Defining Navigation

Define navigation relationships using the `navigationPaths` option when creating table occurrences:

```typescript
import { fmTableOccurrence, textField } from "@proofkit/fmodata";

const contacts = fmTableOccurrence(
  "contacts",
  {
    id: textField().primaryKey(),
    name: textField().notNull(),
    userId: textField().notNull(),
  },
  {
    navigationPaths: ["users"], // Valid navigation targets
  },
);

const users = fmTableOccurrence(
  "users",
  {
    id: textField().primaryKey(),
    username: textField().notNull(),
    email: textField().notNull(),
  },
  {
    navigationPaths: ["contacts"], // Valid navigation targets
  },
);

// Use with your database
const db = connection.database("MyDB", {
  occurrences: [contacts, users],
});
```

The `navigationPaths` option:

- Specifies which table occurrences can be navigated to from this table
- Enables runtime validation when using `expand()` or `navigate()`
- Throws descriptive errors if you try to navigate to an invalid path

### Navigating Between Tables

Navigate to related records:

```typescript
// Navigate from a specific record (using column references)
const result = await db
  .from(contacts)
  .get("contact-123")
  .navigate(users)
  .select({
    username: users.username,
    email: users.email,
  })
  .execute();

// Navigate without specifying a record first
const result = await db.from(contacts).navigate(users).list().execute();

// Using legacy API with string field names
const result = await db
  .from(contacts)
  .get("contact-123")
  .navigate(users)
  .select({ username: users.username, email: users.email })
  .execute();
```

### Expanding Related Records

Use `expand()` to include related records in your query results. The library validates that the target table is in the source table's `navigationPaths`:

```typescript
// Simple expand
const result = await db.from(contacts).list().expand(users).execute();

// Expand with field selection (using column references)
const result = await db
  .from(contacts)
  .list()
  .expand(users, (b) =>
    b.select({
      username: users.username,
      email: users.email,
    }),
  )
  .execute();

// Expand with filtering (using new ORM API)
import { eq } from "@proofkit/fmodata";

const result = await db
  .from(contacts)
  .list()
  .expand(users, (b) => b.where(eq(users.active, true)))
  .execute();

// Multiple expands
const result = await db
  .from(contacts)
  .list()
  .expand(users, (b) => b.select({ username: users.username }))
  .expand(orders, (b) => b.select({ total: orders.total }).top(5))
  .execute();

// Nested expands
const result = await db
  .from(contacts)
  .list()
  .expand(users, (usersBuilder) =>
    usersBuilder
      .select({
        username: users.username,
        email: users.email,
      })
      .expand(customers, (customerBuilder) =>
        customerBuilder.select({
          name: customers.name,
          tier: customers.tier,
        }),
      ),
  )
  .execute();

// Complex expand with multiple options
const result = await db
  .from(contacts)
  .list()
  .expand(users, (b) =>
    b
      .select({
        username: users.username,
        email: users.email,
      })
      .where(eq(users.active, true))
      .orderBy(asc(users.username))
      .top(10)
      .expand(customers, (nested) => nested.select({ name: customers.name })),
  )
  .execute();
```

## Running Scripts

Execute FileMaker scripts via OData:

```typescript
// Simple script execution
const result = await db.runScript("MyScriptName");

console.log(result.resultCode); // Script result code
console.log(result.result); // Optional script result string

// Pass parameters to script
const result = await db.runScript("MyScriptName", {
  scriptParam: "some value",
});

// Script parameters can be strings, numbers, or objects
const result = await db.runScript("ProcessOrder", {
  scriptParam: {
    orderId: "12345",
    action: "approve",
  }, // Will be JSON stringified
});

// Validate script result with Zod schema
// NOTE: Your validator must be able to parse a string.
// See Zod codecs for how to build a jsonCodec function that does this
// https://zod.dev/codecs?id=jsonschema

const schema = jsonCodec(
  z.object({
    success: z.boolean(),
    message: z.string(),
    recordId: z.string(),
  }),
);

const result = await db.runScript("CreateRecord", {
  resultSchema: schema,
});

// result.result is now typed based on your schema
console.log(result.result.recordId);
```

**Note:** OData doesn't support script names with special characters (e.g., `@`, `&`, `/`) or script names beginning with a number. TypeScript will catch these at compile time.

## Webhooks

Webhooks allow you to receive notifications when data changes in your FileMaker database. The library provides a type-safe API for managing webhooks through the `db.webhook` property.

### Adding a Webhook

Create a new webhook to monitor a table for changes:

```typescript
// Basic webhook
const result = await db.webhook.add({
  webhook: "https://example.com/webhook",
  tableName: contactsTable,
});

// Access the created webhook ID
console.log(result.webhookResult.webhookID);
```

### Webhook Configuration Options

Webhooks support various configuration options:

```typescript
// With custom headers
const result = await db.webhook.add({
  webhook: "https://example.com/webhook",
  tableName: contactsTable,
  headers: {
    "X-Custom-Header": "value",
    Authorization: "Bearer token",
  },
  notifySchemaChanges: true, // Notify when schema changes
});

// With field selection (using column references)
const result = await db.webhook.add({
  webhook: "https://example.com/webhook",
  tableName: contacts,
  select: [contacts.name, contacts.email, contacts.PrimaryKey],
});

// With filtering (using filter expressions)
import { eq, gt } from "@proofkit/fmodata";

const result = await db.webhook.add({
  webhook: "https://example.com/webhook",
  tableName: contacts,
  filter: eq(contacts.active, true),
  select: [contacts.name, contacts.email],
});

// Complex filter example
const result = await db.webhook.add({
  webhook: "https://example.com/webhook",
  tableName: users,
  filter: and(eq(users.active, true), gt(users.age, 18)),
  select: [users.username, users.email],
});
```

**Webhook Configuration Properties:**

- `webhook` (required) - The URL to call when the webhook is triggered
- `tableName` (required) - The `FMTable` instance for the table to monitor
- `headers` (optional) - Custom headers to include in webhook requests
- `notifySchemaChanges` (optional) - Whether to notify on schema changes
- `select` (optional) - Field selection as a string or array of `Column` references
- `filter` (optional) - Filter expression (string or `FilterExpression`) to limit which records trigger the webhook

### Listing Webhooks

Get all webhooks configured for the database:

```typescript
const result = await db.webhook.list();

console.log(result.status); // Status of the operation
console.log(result.webhooks); // Array of webhook configurations

result.webhooks.forEach((webhook) => {
  console.log(`Webhook ${webhook.webhookID}:`);
  console.log(`  Table: ${webhook.tableName}`);
  console.log(`  URL: ${webhook.webhook}`);
  console.log(`  Notify Schema Changes: ${webhook.notifySchemaChanges}`);
  console.log(`  Select: ${webhook.select}`);
  console.log(`  Filter: ${webhook.filter}`);
  console.log(`  Pending Operations: ${webhook.pendingOperations.length}`);
});
```

### Getting a Webhook

Retrieve a specific webhook by ID:

```typescript
const webhook = await db.webhook.get(1);

console.log(webhook.webhookID);
console.log(webhook.tableName);
console.log(webhook.webhook);
console.log(webhook.headers);
console.log(webhook.notifySchemaChanges);
console.log(webhook.select);
console.log(webhook.filter);
console.log(webhook.pendingOperations);
```

### Removing a Webhook

Delete a webhook by ID:

```typescript
await db.webhook.remove(1);
```

### Invoking a Webhook

Manually trigger a webhook. This is useful for testing or triggering webhooks on-demand:

```typescript
// Invoke for all rows matching the webhook's filter
await db.webhook.invoke(1);

// Invoke for specific row IDs
await db.webhook.invoke(1, { rowIDs: [63, 61] });
```

### Complete Example

Here's a complete example of setting up and managing webhooks:

```typescript
import { eq } from "@proofkit/fmodata";

// Add a webhook to monitor active contacts
const addResult = await db.webhook.add({
  webhook: "https://api.example.com/webhooks/contacts",
  tableName: contacts,
  headers: {
    "X-API-Key": "your-api-key",
  },
  filter: eq(contacts.active, true),
  select: [contacts.name, contacts.email, contacts.PrimaryKey],
  notifySchemaChanges: false,
});

const webhookId = addResult.webhookResult.webhookID;
console.log(`Created webhook with ID: ${webhookId}`);

// List all webhooks
const listResult = await db.webhook.list();
console.log(`Total webhooks: ${listResult.webhooks.length}`);

// Get the webhook we just created
const webhook = await db.webhook.get(webhookId);
console.log(`Webhook URL: ${webhook.webhook}`);

// Manually invoke the webhook for specific records
await db.webhook.invoke(webhookId, { rowIDs: [1, 2, 3] });

// Remove the webhook when done
await db.webhook.remove(webhookId);
```

**Note:** Webhooks are triggered automatically by FileMaker when records matching the webhook's filter are created, updated, or deleted. The `invoke()` method allows you to manually trigger webhooks for testing or on-demand processing.

## Batch Operations

Batch operations allow you to execute multiple queries and operations together in a single request. All operations in a batch are executed atomically - they all succeed or all fail together. This is both more efficient (fewer network round-trips) and ensures data consistency across related operations.

### Batch Result Structure

Batch operations return a `BatchResult` object that contains individual results for each operation. Each result has its own `data`, `error`, and `status` properties, allowing you to handle success and failure on a per-operation basis:

```typescript
type BatchItemResult<T> = {
  data: T | undefined;
  error: FMODataErrorType | undefined;
  status: number; // HTTP status code (0 for truncated operations)
};

type BatchResult<T extends readonly any[]> = {
  results: { [K in keyof T]: BatchItemResult<T[K]> };
  successCount: number;
  errorCount: number;
  truncated: boolean; // true if FileMaker stopped processing due to an error
  firstErrorIndex: number | null; // Index of the first operation that failed
};
```

### Basic Batch with Multiple Queries

Execute multiple read operations in a single batch:

```typescript
// Create query builders
const contactsQuery = db.from(contacts).list().top(5);
const usersQuery = db.from(users).list().top(5);

// Execute both queries in a single batch
const result = await db.batch([contactsQuery, usersQuery]).execute();

// Access individual results
const [r1, r2] = result.results;

if (r1.error) {
  console.error("Contacts query failed:", r1.error);
} else {
  console.log("Contacts:", r1.data);
}

if (r2.error) {
  console.error("Users query failed:", r2.error);
} else {
  console.log("Users:", r2.data);
}

// Check summary statistics
console.log(`Success: ${result.successCount}, Errors: ${result.errorCount}`);
```

### Mixed Operations (Reads and Writes)

Combine queries, inserts, updates, and deletes in a single batch:

```typescript
// Mix different operation types
const listQuery = db.from(contacts).list().top(10);
const insertOp = db.from(contacts).insert({
  name: "John Doe",
  email: "john@example.com",
});
const updateOp = db.from(users).update({ active: true }).byId("user-123");

// All operations execute atomically
const result = await db.batch([listQuery, insertOp, updateOp]).execute();

// Access individual results
const [r1, r2, r3] = result.results;

if (r1.error) {
  console.error("List query failed:", r1.error);
} else {
  console.log("Fetched contacts:", r1.data);
}

if (r2.error) {
  console.error("Insert failed:", r2.error);
} else {
  console.log("Inserted contact:", r2.data);
}

if (r3.error) {
  console.error("Update failed:", r3.error);
} else {
  console.log("Updated user:", r3.data);
}
```

### Handling Errors in Batches

When FileMaker encounters an error in a batch operation, it **stops processing** subsequent operations. Operations that were never executed due to an earlier error will have a `BatchTruncatedError`:

```typescript
import { BatchTruncatedError, isBatchTruncatedError } from "@proofkit/fmodata";

const result = await db.batch([query1, query2, query3]).execute();

const [r1, r2, r3] = result.results;

// First operation succeeded
if (r1.error) {
  console.error("First query failed:", r1.error);
} else {
  console.log("First query succeeded:", r1.data);
}

// Second operation failed
if (r2.error) {
  console.error("Second query failed:", r2.error);
  console.log("HTTP Status:", r2.status); // e.g., 404
}

// Third operation was never executed (truncated)
if (r3.error && isBatchTruncatedError(r3.error)) {
  console.log("Third operation was not executed");
  console.log(`Failed at operation ${r3.error.failedAtIndex}`);
  console.log(`This operation index: ${r3.error.operationIndex}`);
  console.log("Status:", r3.status); // 0 (never executed)
}

// Check if batch was truncated
if (result.truncated) {
  console.log(`Batch stopped early at index ${result.firstErrorIndex}`);
}
```

### Transactional Behavior

Batch operations are transactional for write operations (inserts, updates, deletes). If any operation in the batch fails, all write operations are rolled back:

```typescript
const result = await db
  .batch([
    db.from(users).insert({ username: "alice", email: "alice@example.com" }),
    db.from(users).insert({ username: "bob", email: "bob@example.com" }),
    db.from(users).insert({ username: "charlie", email: "invalid" }), // This fails
  ])
  .execute();

// Check individual results
const [r1, r2, r3] = result.results;

if (r1.error || r2.error || r3.error) {
  // All three inserts are rolled back - no users were created
  console.error("Batch had errors:");
  if (r1.error) console.error("Operation 1:", r1.error);
  if (r2.error) console.error("Operation 2:", r2.error);
  if (r3.error) console.error("Operation 3:", r3.error);
}
```

### Important Notes

- **FileMaker stops on first error**: When an error occurs, FileMaker stops processing subsequent operations in the batch. Truncated operations will have `BatchTruncatedError` with `status: 0`.
- **Insert operations in batches**: FileMaker ignores `Prefer: return=representation` in batch requests. Insert operations return `{}` or `{ ROWID?: number }` instead of the full created record.
- **All results are always defined**: Every operation in the batch will have a corresponding result in `result.results`, even if it was never executed (truncated operations).
- **Summary statistics**: Use `result.successCount`, `result.errorCount`, `result.truncated`, and `result.firstErrorIndex` for quick batch status checks.

**Note:** Batch operations automatically group write operations (POST, PATCH, DELETE) into changesets for transactional behavior, while read operations (GET) are executed individually within the batch.

## Schema Management

The library provides methods for managing database schema through the `db.schema` property. You can create and delete tables, add and remove fields, and manage indexes.

### Creating Tables

Create a new table with field definitions:

```typescript
import type { Field } from "@proofkit/fmodata";

const fields: Field[] = [
  {
    name: "id",
    type: "string",
    primary: true,
    maxLength: 36,
  },
  {
    name: "username",
    type: "string",
    nullable: false,
    unique: true,
    maxLength: 50,
  },
  {
    name: "email",
    type: "string",
    nullable: false,
    maxLength: 255,
  },
  {
    name: "age",
    type: "numeric",
    nullable: true,
  },
  {
    name: "created_at",
    type: "timestamp",
    default: "CURRENT_TIMESTAMP",
  },
];

const tableDefinition = await db.schema.createTable("users", fields);
console.log(tableDefinition.tableName); // "users"
console.log(tableDefinition.fields); // Array of field definitions
```

### Field Types

The library supports various field types:

**String Fields:**

```typescript
{
  name: "username",
  type: "string",
  maxLength: 100, // Optional: varchar(100)
  nullable: true,
  unique: true,
  default: "USER" | "USERNAME" | "CURRENT_USER", // Optional
  repetitions: 5, // Optional: for repeating fields
}
```

**Numeric Fields:**

```typescript
{
  name: "age",
  type: "numeric",
  nullable: true,
  primary: false,
  unique: false,
}
```

**Date Fields:**

```typescript
{
  name: "birth_date",
  type: "date",
  default: "CURRENT_DATE" | "CURDATE", // Optional
  nullable: true,
}
```

**Time Fields:**

```typescript
{
  name: "start_time",
  type: "time",
  default: "CURRENT_TIME" | "CURTIME", // Optional
  nullable: true,
}
```

**Timestamp Fields:**

```typescript
{
  name: "created_at",
  type: "timestamp",
  default: "CURRENT_TIMESTAMP" | "CURTIMESTAMP", // Optional
  nullable: false,
}
```

**Container Fields:**

```typescript
{
  name: "avatar",
  type: "container",
  externalSecurePath: "/secure/path", // Optional
  nullable: true,
}
```

### Adding Fields to Existing Tables

Add new fields to an existing table:

```typescript
const newFields: Field[] = [
  {
    name: "phone",
    type: "string",
    nullable: true,
    maxLength: 20,
  },
  {
    name: "bio",
    type: "string",
    nullable: true,
    maxLength: 1000,
  },
];

const updatedTable = await db.schema.addFields("users", newFields);
```

### Deleting Tables and Fields

Delete an entire table:

```typescript
await db.schema.deleteTable("old_table");
```

Delete a specific field from a table:

```typescript
await db.schema.deleteField("users", "old_field");
```

### Managing Indexes

Create an index on a field:

```typescript
const index = await db.schema.createIndex("users", "email");
console.log(index.indexName); // "email"
```

Delete an index:

```typescript
await db.schema.deleteIndex("users", "email");
```

### Complete Example

Here's a complete example of creating a table with various field types:

```typescript
const fields: Field[] = [
  // Primary key
  {
    name: "id",
    type: "string",
    primary: true,
    maxLength: 36,
  },

  // String fields
  {
    name: "username",
    type: "string",
    nullable: false,
    unique: true,
    maxLength: 50,
  },
  {
    name: "email",
    type: "string",
    nullable: false,
    maxLength: 255,
  },

  // Numeric field
  {
    name: "age",
    type: "numeric",
    nullable: true,
  },

  // Date/time fields
  {
    name: "birth_date",
    type: "date",
    nullable: true,
  },
  {
    name: "created_at",
    type: "timestamp",
    default: "CURRENT_TIMESTAMP",
    nullable: false,
  },

  // Container field
  {
    name: "avatar",
    type: "container",
    nullable: true,
  },

  // Repeating field
  {
    name: "tags",
    type: "string",
    repetitions: 5,
    maxLength: 50,
  },
];

// Create the table
const table = await db.schema.createTable("users", fields);

// Later, add more fields
await db.schema.addFields("users", [
  {
    name: "phone",
    type: "string",
    nullable: true,
  },
]);

// Create an index on email
await db.schema.createIndex("users", "email");
```

**Note:** Schema management operations require appropriate access privileges on your FileMaker account. Operations will throw errors if you don't have the necessary permissions.

## Advanced Features

### Required and Read-Only Fields

The library automatically infers which fields are required based on field builder configuration:

```typescript
const users = fmTableOccurrence("users", {
  id: textField().primaryKey(), // Auto-required, auto-readOnly (primaryKey)
  username: textField().notNull(), // Auto-required (notNull)
  email: textField().notNull(), // Auto-required (notNull)
  status: textField(), // Optional (nullable by default)
  createdAt: timestampField().readOnly(), // Read-only system field
  updatedAt: timestampField(), // Optional (nullable)
});

// Insert: username and email are required
// Insert: id and createdAt are excluded (cannot be provided - read-only)
db.from(users).insert({
  username: "john",
  email: "john@example.com",
  status: "active", // Optional
  updatedAt: new Date().toISOString(), // Optional
});

// Update: all fields are optional except id and createdAt are excluded
db.from(users)
  .update({
    status: "active", // Optional
    // id and createdAt cannot be modified (read-only)
  })
  .byId("user-123");
```

**Key Features:**

- **Auto-inference:** Fields with `.notNull()` are automatically required for insert
- **Primary keys:** Fields with `.primaryKey()` are automatically read-only
- **Read-only fields:** Use `.readOnly()` to exclude fields from insert/update (e.g., timestamps, calculated fields)
- **Update flexibility:** All fields are optional for updates (except read-only fields)

### Prefer: fmodata.entity-ids

This library supports using FileMaker's internal field identifiers (FMFID) and table occurrence identifiers (FMTID) instead of names. This protects your integration from both field and table occurrence name changes.

To enable this feature, simply define your schema with entity IDs using the `.entityId()` method on field builders and the `entityId` option in `fmTableOccurrence()`. Behind the scenes, the library will transform your request and the response back to the names you specify in your schema. This is an all-or-nothing feature. For it to work properly, you must define all table occurrences passed to a `Database` with entity IDs (both field IDs via `.entityId()` and table ID via the `entityId` option).

_Note for OttoFMS proxy: This feature requires version 4.14 or later of OttoFMS_

How do I find these ids? They can be found in the XML version of the `$metadata` endpoint for your database, or you can calculate them using these [custom functions](https://github.com/rwu2359/CFforID) from John Renfrew

#### Basic Usage

```typescript
import {
  fmTableOccurrence,
  textField,
  timestampField,
} from "@proofkit/fmodata";

// Define a table with FileMaker field IDs and table occurrence ID
const users = fmTableOccurrence(
  "users",
  {
    id: textField().primaryKey().entityId("FMFID:12039485"),
    username: textField().notNull().entityId("FMFID:34323433"),
    email: textField().entityId("FMFID:12232424"),
    createdAt: timestampField().readOnly().entityId("FMFID:43234355"),
  },
  {
    entityId: "FMTID:12432533", // FileMaker table occurrence ID
  },
);
```

### Special Columns (ROWID and ROWMODID)

FileMaker provides special columns `ROWID` and `ROWMODID` that uniquely identify records and track modifications. These can be included in query responses when enabled.

Enable special columns at the database level:

```typescript
const db = connection.database("MyDatabase", {
  includeSpecialColumns: true,
});

const result = await db.from(users).list().execute();
// result.data[0] will have ROWID and ROWMODID properties
```

Override at the request level:

```typescript
// Enable for this request only
const result = await db.from(users).list().execute({
  includeSpecialColumns: true,
});

// Disable for this request
const result = await db.from(users).list().execute({
  includeSpecialColumns: false,
});
```

Use `ROWID` to hydrate a single record when you only have webhook metadata:

```typescript
const result = await db
  .from(users)
  .get({ ROWID: 2 })
  .execute();
```

**Important:** Special columns are only included when no `$select` query is applied (per OData specification). When using `.select()`, special columns are excluded even if `includeSpecialColumns` is enabled.

### Error Handling

All operations return a `Result` type with either `data` or `error`. The library provides rich error types that help you handle different error scenarios appropriately.

#### Basic Error Checking

```typescript
const result = await db.from(users).list().execute();

if (result.error) {
  console.error("Query failed:", result.error.message);
  return;
}

if (result.data) {
  console.log("Query succeeded:", result.data);
}
```

#### HTTP Errors

Handle HTTP status codes (4xx, 5xx) with the `HTTPError` class:

```typescript
import { HTTPError, isHTTPError } from "@proofkit/fmodata";

const result = await db.from(users).list().execute();

if (result.error) {
  if (isHTTPError(result.error)) {
    // TypeScript knows this is HTTPError
    console.log("HTTP Status:", result.error.status);

    if (result.error.isNotFound()) {
      console.log("Resource not found");
    } else if (result.error.isUnauthorized()) {
      console.log("Authentication required");
    } else if (result.error.is5xx()) {
      console.log("Server error - try again later");
    } else if (result.error.is4xx()) {
      console.log("Client error:", result.error.statusText);
    }

    // Access the response body if available
    if (result.error.response) {
      console.log("Error details:", result.error.response);
    }
  }
}
```

#### Network Errors

Handle network-level errors (timeouts, connection issues, etc.):

```typescript
import {
  TimeoutError,
  NetworkError,
  RetryLimitError,
  CircuitOpenError,
} from "@proofkit/fmodata";

const result = await db.from(users).list().execute();

if (result.error) {
  if (result.error instanceof TimeoutError) {
    console.log("Request timed out");
    // Show user-friendly timeout message
  } else if (result.error instanceof NetworkError) {
    console.log("Network connectivity issue");
    // Show offline message
  } else if (result.error instanceof RetryLimitError) {
    console.log("Request failed after retries");
    // Log the underlying error: result.error.cause
  } else if (result.error instanceof CircuitOpenError) {
    console.log("Service is currently unavailable");
    // Show maintenance message
  }
}
```

#### Validation Errors

When schema validation fails, you get a `ValidationError` with rich context:

```typescript
import { ValidationError, isValidationError } from "@proofkit/fmodata";

const result = await db.from(users).list().execute();

if (result.error) {
  if (isValidationError(result.error)) {
    // Access validation issues (Standard Schema format)
    console.log("Validation failed for field:", result.error.field);
    console.log("Issues:", result.error.issues);
    console.log("Failed value:", result.error.value);
  }
}
```

**Validator-Agnostic Error Handling**

The library uses [Standard Schema](https://github.com/standard-schema/standard-schema) to support any validation library (Zod, Valibot, ArkType, etc.). Following the same pattern as [uploadthing](https://github.com/pingdotgg/uploadthing), the `ValidationError.cause` property contains the normalized Standard Schema issues array:

```typescript
import { ValidationError } from "@proofkit/fmodata";

const result = await db.from(users).list().execute();

if (result.error instanceof ValidationError) {
  // The cause property (ES2022 Error.cause) contains the Standard Schema issues array
  // This is validator-agnostic and works with Zod, Valibot, ArkType, etc.
  console.log("Validation issues:", result.error.cause);
  console.log("Issues are also available directly:", result.error.issues);

  // Both point to the same array
  console.log(result.error.cause === result.error.issues); // true

  // Access additional context
  console.log("Failed field:", result.error.field);
  console.log("Failed value:", result.error.value);

  // Standard Schema issues have a normalized format
  result.error.issues.forEach((issue) => {
    console.log("Path:", issue.path);
    console.log("Message:", issue.message);
  });
}
```

**Why Standard Schema Issues Instead of Original Validator Errors?**

By using Standard Schema's normalized issue format in the `cause` property, the library remains truly validator-agnostic. All validation libraries that implement Standard Schema (Zod, Valibot, ArkType, etc.) produce the same issue structure, making error handling consistent regardless of which validator you choose.

If you need validator-specific error formatting, you can still access your validator's methods during validation before the data reaches fmodata:

```typescript
import { z } from "zod";

const userSchema = z.object({
  email: z.string().email(),
  age: z.number().min(0).max(150),
});

// Validate early if you need Zod-specific error handling
const parseResult = userSchema.safeParse(userData);
if (!parseResult.success) {
  // Use Zod's error formatting
  const formatted = parseResult.error.flatten();
  console.log("Zod-specific formatting:", formatted);
}
```

#### OData Errors

Handle OData-specific protocol errors:

```typescript
import { ODataError, isODataError } from "@proofkit/fmodata";

const result = await db.from(users).list().execute();

if (result.error) {
  if (isODataError(result.error)) {
    console.log("OData Error Code:", result.error.code);
    console.log("OData Error Message:", result.error.message);
    console.log("OData Error Details:", result.error.details);
  }
}
```

#### Error Handling Patterns

**Pattern 1: Using instanceof (like ffetch):**

```typescript
import {
  HTTPError,
  ValidationError,
  TimeoutError,
  NetworkError,
} from "@proofkit/fmodata";

const result = await db.from(users).list().execute();

if (result.error) {
  if (result.error instanceof TimeoutError) {
    showTimeoutMessage();
  } else if (result.error instanceof HTTPError) {
    if (result.error.isNotFound()) {
      showNotFoundMessage();
    } else if (result.error.is5xx()) {
      showServerErrorMessage();
    }
  } else if (result.error instanceof ValidationError) {
    showValidationError(result.error.field, result.error.issues);
  } else if (result.error instanceof NetworkError) {
    showOfflineMessage();
  }
}
```

**Pattern 2: Using kind property (for exhaustive matching):**

```typescript
const result = await db.from(users).list().execute();

if (result.error) {
  switch (result.error.kind) {
    case "TimeoutError":
      showTimeoutMessage();
      break;
    case "HTTPError":
      handleHTTPError(result.error.status);
      break;
    case "ValidationError":
      showValidationError(result.error.field, result.error.issues);
      break;
    case "NetworkError":
      showOfflineMessage();
      break;
    case "ODataError":
      handleODataError(result.error.code);
      break;
    // TypeScript ensures exhaustive matching!
  }
}
```

**Pattern 3: Using type guards:**

```typescript
import {
  isHTTPError,
  isValidationError,
  isODataError,
  isNetworkError,
} from "@proofkit/fmodata";

const result = await db.from("users").list().execute();

if (result.error) {
  if (isHTTPError(result.error)) {
    // TypeScript knows this is HTTPError
    console.log("Status:", result.error.status);
  } else if (isValidationError(result.error)) {
    // TypeScript knows this is ValidationError
    console.log("Field:", result.error.field);
    console.log("Issues:", result.error.issues);
  } else if (isODataError(result.error)) {
    // TypeScript knows this is ODataError
    console.log("Code:", result.error.code);
  } else if (isNetworkError(result.error)) {
    // TypeScript knows this is NetworkError
    console.log("Network issue:", result.error.cause);
  }
}
```

#### Error Properties

All errors include helpful metadata:

```typescript
if (result.error) {
  // All errors have a timestamp
  console.log("Error occurred at:", result.error.timestamp);

  // All errors have a kind property for discriminated unions
  console.log("Error kind:", result.error.kind);

  // All errors have a message
  console.log("Error message:", result.error.message);
}
```

#### Available Error Types

- **`HTTPError`** - HTTP status errors (4xx, 5xx) with helper methods (`is4xx()`, `is5xx()`, `isNotFound()`, etc.)
- **`ODataError`** - OData protocol errors with code and details
- **`ValidationError`** - Schema validation failures with issues, schema reference, and failed value
- **`ResponseStructureError`** - Malformed API responses
- **`RecordCountMismatchError`** - When `single()` or `maybeSingle()` expectations aren't met
- **`TimeoutError`** - Request timeout (from ffetch)
- **`NetworkError`** - Network connectivity issues (from ffetch)
- **`RetryLimitError`** - Request failed after retries (from ffetch)
- **`CircuitOpenError`** - Circuit breaker is open (from ffetch)
- **`AbortError`** - Request was aborted (from ffetch)

### OData Annotations and Validation

By default, the library automatically strips OData annotations fields (`@id` and `@editLink`) from responses. If you need these fields, you can include them by passing `includeODataAnnotations: true`:

```typescript
const result = await db.from("users").list().execute({
  includeODataAnnotations: true,
});
```

You can also skip runtime validation by passing `skipValidation: true`.

```typescript
const result = await db.from("users").list().execute({
  skipValidation: true,
});

// Response is returned without schema validation
```

**Note:** Skipping validation means the response won't be validated OR transformed against your schema, so you lose runtime type safety guarantees. Use with caution.

### Custom Fetch Handlers

You can provide custom fetch handlers for testing or custom networking:

```typescript
const customFetch = async (url, options) => {
  console.log("Fetching:", url);
  return fetch(url, options);
};

const result = await db.from("users").list().execute({
  fetchHandler: customFetch,
});
```

## Testing

The library supports testing with custom fetch handlers. You can create mock fetch functions to return test data:

```typescript
const mockResponse = {
  "@odata.context": "...",
  value: [
    { id: "1", username: "john", email: "john@example.com" },
    { id: "2", username: "jane", email: "jane@example.com" },
  ],
};

const mockFetch = async () => {
  return new Response(JSON.stringify(mockResponse), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};

const result = await db.from("users").list().execute({
  fetchHandler: mockFetch,
});

expect(result.data).toHaveLength(2);
expect(result.data[0].username).toBe("john");
```

You can also inspect query strings without executing:

```typescript
const queryString = db
  .from("users")
  .list()
  .select("username", "email")
  .where(eq(users.active, true))
  .orderBy("username")
  .top(10)
  .getQueryString();

console.log(queryString);
// Output: "/users?$select=username,email&$filter=active eq true&$orderby=username&$top=10"
```
