# InstantDB - Getting Started

## What is InstantDB?

InstantDB is a modern database that provides:
- **Real-time sync** - Changes propagate instantly to all connected clients
- **Client-side queries** - Query data directly from the browser/client
- **Graph relationships** - Define links between entities with forward/reverse traversal
- **TypeScript first** - Full type safety with schema definitions

## Why InstantDB for This Project?

We use InstantDB for all CRUD operations because:

1. **Real-time Updates** - Inventory, orders, and products sync instantly
2. **Type Safety** - Full TypeScript support with schema validation
3. **Relationships** - Natural graph queries for products → inventory → orders
4. **Simplicity** - No need to manage WebSocket connections manually
5. **Backend SDK** - Admin SDK for server-side operations

## Setup

### 1. Install Dependencies

```bash
npm install @instantdb/admin
```

### 2. Configure Environment

Create `.env` file:

```env
INSTANTDB_APP_ID=d2c4873f-988d-4a4d-977b-9b4746b94936
INSTANTDB_ADMIN_TOKEN=your-admin-token
```

### 3. Define Schema

Create `instant.schema.ts` in project root:

```typescript
import { i } from "@instantdb/admin";

const _schema = i.schema({
  entities: {
    products: i.entity({
      name: i.string(),
      description: i.string().optional(),
      category: i.string(),
      available: i.boolean(),
      createdAt: i.number(),
      updatedAt: i.number(),
    }),

    inventoryItems: i.entity({
      price: i.number().indexed(),
      quantity: i.number().indexed(),
      inStock: i.boolean().indexed(),
    }),
  },

  links: {
    productInventory: {
      forward: { on: "inventoryItems", has: "one", label: "product" },
      reverse: { on: "products", has: "many", label: "inventoryItems" },
    },
  },
});

export default _schema;
```

### 4. Push Schema to InstantDB

```bash
npx instant-cli@latest push schema --app <your-app-id> --yes
```

Or configure `instant.config.json`:

```json
{
  "app": {
    "id": "d2c4873f-988d-4a4d-977b-9b4746b94936",
    "title": "Universal Commerce AI System"
  }
}
```

Then simply:

```bash
npx instant-cli@latest push schema --yes
```

### 5. Initialize Client

```typescript
import { init, id, tx } from "@instantdb/admin";
import schema from "./instant.schema";

export const idb = init({
  appId: process.env.INSTANTDB_APP_ID,
  adminToken: process.env.INSTANTDB_ADMIN_TOKEN,
  schema,
});

export { id, tx };
```

## Basic Operations

### Creating Entities

```typescript
import { idb, id, tx } from "./instantdb-client";

// Create a product with inventory
const productId = id();
const inventoryId = id();

await idb.transact([
  tx.products[productId].update({
    name: "Premium Coffee Beans",
    description: "Ethiopian single-origin",
    category: "Coffee",
    available: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }),

  tx.inventoryItems[inventoryId]
    .update({
      price: 24.99,
      quantity: 100,
      inStock: true,
    })
    .link({ product: productId }),
]);
```

### Querying Data

```typescript
// Query products with their inventory
const result = await idb.query({
  products: {
    $: { where: { available: true } },
    inventoryItems: {}, // Include related inventory
  },
});

result.products.forEach(product => {
  console.log(product.name);
  console.log(product.inventoryItems); // Array of linked items
});
```

### Updating Entities

```typescript
await idb.transact([
  tx.products[productId].update({
    description: "New description",
    updatedAt: Date.now(),
  }),
]);
```

### Creating Relationships

```typescript
// Link an order to a provider
await idb.transact([
  tx.orders[orderId].link({ provider: providerId }),
]);

// Unlink
await idb.transact([
  tx.orders[orderId].unlink({ provider: providerId }),
]);
```

## Schema Design Patterns

### 1. Timestamps
Always include `createdAt` and `updatedAt`:

```typescript
createdAt: i.number(),
updatedAt: i.number(),
```

Set them:
```typescript
createdAt: Date.now(),
updatedAt: Date.now(),
```

### 2. Optional Fields
Use `.optional()` for nullable fields:

```typescript
description: i.string().optional(),
phone: i.string().optional(),
```

### 3. Indexes
Index frequently queried fields:

```typescript
email: i.string().unique().indexed(),
price: i.number().indexed(),
```

### 4. JSON Fields
Store arrays and objects:

```typescript
tags: i.json().optional(), // Store ["tag1", "tag2"]
items: i.json(), // Store [{productId, quantity}]
```

### 5. Relationships
Define bidirectional links:

```typescript
// One-to-many: product -> many inventoryItems
productInventory: {
  forward: { on: "inventoryItems", has: "one", label: "product" },
  reverse: { on: "products", has: "many", label: "inventoryItems" },
}
```

## Query Patterns

### Filter by Field

```typescript
const result = await idb.query({
  products: {
    $: { where: { category: "Coffee" } },
  },
});
```

### Filter by Relationship

```typescript
// Get products from specific provider
const result = await idb.query({
  products: {
    $: { where: { "provider.id": providerId } },
    provider: {},
  },
});
```

### Text Search

```typescript
const result = await idb.query({
  products: {
    $: { where: { name: { $ilike: `%${query}%` } } },
  },
});
```

### Complex Queries

```typescript
// Get orders with items and provider details
const result = await idb.query({
  orders: {
    $: {
      where: {
        userId: currentUserId,
        completed: true,
      },
      limit: 10,
    },
    provider: {},
    user: {},
  },
});
```

## Common Issues

### UUID Validation Error

❌ Error: "Invalid id for entity 'providers'. Expected a UUID"

✅ Solution: Always use `id()` function from InstantDB:

```typescript
import { id } from "@instantdb/admin";

const providerId = id(); // ✅ Generates valid UUID
const providerId = "my-custom-id"; // ❌ Won't work
```

### Schema Validation Error

❌ Error: "Attributes are missing in your schema"

✅ Solution: Push schema using CLI:

```bash
npx instant-cli@latest push schema --app <app-id> --yes
```

### Missing Relationships

❌ Query doesn't return linked entities

✅ Solution: Include relationship in query:

```typescript
const result = await idb.query({
  products: {
    inventoryItems: {}, // ✅ Include this
  },
});
```

## Best Practices

1. **Use TypeScript** - Import and use the schema type for autocomplete
2. **Batch Operations** - Use `transact()` for multiple updates
3. **Index Frequently Queried Fields** - Add `.indexed()` to improve query performance
4. **Handle Optionals** - Always check for optional fields before accessing
5. **Use Meaningful IDs** - Let InstantDB generate UUIDs with `id()`

## Next Steps

- [Schema Management](./schema-management.md)
- [Real-time Sync](./real-time-sync.md)
- [InstantDB Operations Reference](../database/operations.md)

## Resources

- [InstantDB Documentation](https://www.instantdb.com/docs)
- [InstantDB Discord](https://discord.com/invite/VU53p7uQcE)
- [InstantDB GitHub](https://github.com/instantdb/instant)
