# Code Generation Example

This document demonstrates how the refactored architecture enables clean code generation for table definitions.

## Architecture Benefits

The refactoring separates concerns into three layers:

1. **Schema/Metadata Layer** (`TableDefinition`): Pure data definitions
2. **Execution Context Layer** (`ExecutionContext`): Connection and request handling
3. **Builder Layer** (`Table`, `QueryBuilder`, `RecordBuilder`): Query construction

## Generated Code Pattern

### Example: Generated Table Definitions

```typescript
// Generated file: src/generated/tables.ts
import { TableDefinition } from "@proofkit/fmodata";
import { z } from "zod";

// Generated from FileMaker metadata
export const ContactsTable = new TableDefinition({
  name: "Contacts",
  schema: z.object({
    id: z.number(),
    firstName: z.string(),
    lastName: z.string(),
    email: z.string().email(),
    phone: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zipCode: z.string().optional(),
    createdAt: z.string(),
    modifiedAt: z.string(),
  }),
});

export const ProductsTable = new TableDefinition({
  name: "Products",
  schema: z.object({
    id: z.number(),
    name: z.string(),
    description: z.string(),
    price: z.number(),
    quantity: z.number(),
    category: z.string(),
    sku: z.string(),
    isActive: z.boolean(),
  }),
});

export const OrdersTable = new TableDefinition({
  name: "Orders",
  schema: z.object({
    id: z.number(),
    orderNumber: z.string(),
    customerId: z.number(),
    orderDate: z.string(),
    totalAmount: z.number(),
    status: z.string(),
    shippingAddress: z.string(),
  }),
});

// Export all tables for easy access
export const tables = {
  Contacts: ContactsTable,
  Products: ProductsTable,
  Orders: OrdersTable,
} as const;
```

## Usage Examples

### Basic Usage with Generated Definitions

```typescript
import { FileMakerOData, Table } from "@proofkit/fmodata";
import { ContactsTable } from "./generated/tables";

// Create client connection
const client = new FileMakerOData({
  serverUrl: "https://api.example.com",
  auth: {
    username: "admin",
    password: "password",
  },
});

// Use generated table definition with client
const contacts = new Table({
  definition: ContactsTable,
  databaseName: "CRM",
  context: client,
});

// Fully type-safe queries
const results = await contacts
  .select("firstName", "lastName", "email")
  .filter({ state: "CA" })
  .orderBy("lastName")
  .execute();
```

### Reusing Definitions Across Multiple Connections

```typescript
import { FileMakerOData, Table } from "@proofkit/fmodata";
import { ProductsTable } from "./generated/tables";

// Production client
const prodClient = new FileMakerOData({
  serverUrl: "https://prod.example.com",
  auth: { apiKey: process.env.PROD_API_KEY! },
});

// Development client
const devClient = new FileMakerOData({
  serverUrl: "https://dev.example.com",
  auth: { apiKey: process.env.DEV_API_KEY! },
});

// Same table definition works with both clients
const prodProducts = new Table({
  definition: ProductsTable,
  databaseName: "Inventory",
  context: prodClient,
});

const devProducts = new Table({
  definition: ProductsTable,
  databaseName: "Inventory",
  context: devClient,
});

// Now you can easily compare data between environments
const prodData = await prodProducts.list().execute();
const devData = await devProducts.list().execute();
```

### Testing with Mock Context

```typescript
import { ExecutionContext, Table } from "@proofkit/fmodata";
import { ContactsTable } from "./generated/tables";

// Create a mock execution context for testing
class MockExecutionContext implements ExecutionContext {
  async _makeRequest(url: string, options?: RequestInit): Promise<any> {
    // Return mock data based on URL
    if (url.includes("Contacts")) {
      return {
        value: [
          {
            id: 1,
            firstName: "John",
            lastName: "Doe",
            email: "john@example.com",
          },
          {
            id: 2,
            firstName: "Jane",
            lastName: "Smith",
            email: "jane@example.com",
          },
        ],
      };
    }
    return { value: [] };
  }
}

// Use table definition with mock context
const mockContext = new MockExecutionContext();
const contacts = new Table({
  definition: ContactsTable,
  databaseName: "TestDB",
  context: mockContext,
});

// Test your code without hitting the real server
const results = await contacts.list().execute();
console.log(results); // Returns mock data
```

### Database Helper Pattern

```typescript
import { FileMakerOData, Table } from "@proofkit/fmodata";
import { tables } from "./generated/tables";

// Create a helper class that provides typed access to all tables
export class Database {
  private client: FileMakerOData;
  private dbName: string;

  constructor(config: { serverUrl: string; auth: any; databaseName: string }) {
    this.client = new FileMakerOData({
      serverUrl: config.serverUrl,
      auth: config.auth,
    });
    this.dbName = config.databaseName;
  }

  get contacts() {
    return new Table({
      definition: tables.Contacts,
      databaseName: this.dbName,
      context: this.client,
    });
  }

  get products() {
    return new Table({
      definition: tables.Products,
      databaseName: this.dbName,
      context: this.client,
    });
  }

  get orders() {
    return new Table({
      definition: tables.Orders,
      databaseName: this.dbName,
      context: this.client,
    });
  }
}

// Usage
const db = new Database({
  serverUrl: "https://api.example.com",
  auth: { username: "admin", password: "password" },
  databaseName: "CRM",
});

const contacts = await db.contacts.list().execute();
const products = await db.products.filter({ isActive: true }).execute();
```

## Code Generator Implementation Notes

When implementing a code generator for this architecture:

1. **Fetch Metadata**: Use the FileMaker OData `$metadata` endpoint to get table and field information
2. **Generate TableDefinitions**: Create one `TableDefinition` per table with full Zod schemas
3. **Type Safety**: Generate proper TypeScript types from the Zod schemas
4. **Export Pattern**: Export both individual table definitions and a `tables` object
5. **No Connection Details**: Table definitions should never contain database names or connection info
6. **Reusability**: The same definitions can be used across multiple databases and environments

## Benefits

- **Separation of Concerns**: Schema definitions are completely independent of connection details
- **Type Safety**: Full TypeScript support with Zod validation
- **Reusability**: Share table definitions across multiple clients and contexts
- **Testability**: Easy to mock execution context for testing
- **Maintainability**: Generated code is clean and easy to understand
- **Flexibility**: Use the same definitions with different databases or servers
