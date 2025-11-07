# InstantDB Schema Reference

## Complete Schema Definition

This document provides the complete schema for all entities in the Universal Commerce AI System.

## Entities

### providers

Vendors and businesses that sell products.

| Attribute | Type | Required | Indexed | Unique | Description |
|-----------|------|----------|---------|--------|-------------|
| `id` | UUID | ✅ | - | ✅ | Auto-generated provider ID |
| `name` | string | ✅ | - | - | Business name |
| `description` | string | - | - | - | Business description |
| `contactEmail` | string | - | - | - | Contact email address |
| `contactPhone` | string | - | - | - | Contact phone number |
| `address` | string | - | - | - | Business address |
| `active` | boolean | ✅ | - | - | Provider is active |
| `verified` | boolean | ✅ | - | - | Provider is verified |
| `createdAt` | number | ✅ | - | - | Creation timestamp (Unix ms) |
| `updatedAt` | number | ✅ | - | - | Last update timestamp (Unix ms) |

**Relationships:**
- `products` - One-to-many link to products
- `orders` - One-to-many link to orders
- `draftOrders` - One-to-many link to draft orders

---

### products

Product catalog items.

| Attribute | Type | Required | Indexed | Unique | Description |
|-----------|------|----------|---------|--------|-------------|
| `id` | UUID | ✅ | - | ✅ | Auto-generated product ID |
| `name` | string | ✅ | - | - | Product name |
| `description` | string | - | - | - | Product description |
| `category` | string | ✅ | - | - | Product category |
| `tags` | json | - | - | - | Array of tags |
| `images` | json | - | - | - | Array of image URLs |
| `available` | boolean | ✅ | - | - | Product is available |
| `featured` | boolean | ✅ | - | - | Product is featured |
| `createdAt` | number | ✅ | - | - | Creation timestamp |
| `updatedAt` | number | ✅ | - | - | Last update timestamp |

**Relationships:**
- `provider` - Many-to-one link to provider
- `inventoryItems` - One-to-many link to inventory items

**Vector Embeddings:**
Products have associated embeddings stored in LibSQL for semantic search.

---

### inventoryItems

Pricing and stock information for products.

| Attribute | Type | Required | Indexed | Unique | Description |
|-----------|------|----------|---------|--------|-------------|
| `id` | UUID | ✅ | - | ✅ | Auto-generated inventory ID |
| `variantName` | string | - | - | - | Variant name (e.g., "Large", "Blue") |
| `price` | number | ✅ | ✅ | - | Price in currency units |
| `quantity` | number | ✅ | ✅ | - | Available quantity |
| `reserved` | number | ✅ | - | - | Reserved quantity (in carts) |
| `inStock` | boolean | ✅ | ✅ | - | Item is in stock |
| `createdAt` | number | ✅ | - | - | Creation timestamp |
| `updatedAt` | number | ✅ | - | - | Last update timestamp |

**Relationships:**
- `product` - Many-to-one link to product

---

### orders

Completed customer orders.

| Attribute | Type | Required | Indexed | Unique | Description |
|-----------|------|----------|---------|--------|-------------|
| `id` | UUID | ✅ | - | ✅ | Auto-generated order ID |
| `orderNumber` | string | ✅ | ✅ | ✅ | Human-readable order number |
| `userId` | string | ✅ | ✅ | - | Customer user ID |
| `items` | json | ✅ | - | - | Array of order items |
| `subtotal` | number | ✅ | - | - | Subtotal before tax/discount |
| `tax` | number | ✅ | - | - | Tax amount |
| `discount` | number | ✅ | - | - | Discount amount |
| `total` | number | ✅ | - | - | Final total |
| `paid` | boolean | ✅ | - | - | Payment received |
| `completed` | boolean | ✅ | ✅ | - | Order completed/fulfilled |
| `notes` | string | - | - | - | Order notes |
| `createdAt` | number | ✅ | - | - | Order creation timestamp |
| `updatedAt` | number | ✅ | - | - | Last update timestamp |

**Relationships:**
- `provider` - Many-to-one link to provider
- `user` - Many-to-one link to user

**Items Structure:**
```json
[
  {
    "productId": "uuid",
    "productName": "Product Name",
    "quantity": 2,
    "price": 24.99
  }
]
```

---

### draftOrders

Shopping carts and incomplete orders.

| Attribute | Type | Required | Indexed | Unique | Description |
|-----------|------|----------|---------|--------|-------------|
| `id` | UUID | ✅ | - | ✅ | Auto-generated draft order ID |
| `orderNumber` | string | - | - | - | Optional order number |
| `userId` | string | ✅ | ✅ | - | Customer user ID |
| `items` | json | ✅ | - | - | Array of cart items |
| `subtotal` | number | ✅ | - | - | Subtotal before tax/discount |
| `tax` | number | ✅ | - | - | Tax amount |
| `discount` | number | ✅ | - | - | Discount amount |
| `total` | number | ✅ | - | - | Final total |
| `paid` | boolean | ✅ | - | - | Payment received |
| `createdAt` | number | ✅ | - | - | Creation timestamp |
| `updatedAt` | number | ✅ | - | - | Last update timestamp |

**Relationships:**
- `provider` - Many-to-one link to provider
- `user` - Many-to-one link to user

---

### users

Customer accounts.

| Attribute | Type | Required | Indexed | Unique | Description |
|-----------|------|----------|---------|--------|-------------|
| `id` | UUID | ✅ | - | ✅ | Auto-generated user ID |
| `name` | string | - | - | - | User's full name |
| `email` | string | ✅ | ✅ | ✅ | Email address |
| `phone` | string | - | - | - | Phone number |
| `active` | boolean | ✅ | - | - | Account is active |
| `createdAt` | number | ✅ | - | - | Account creation timestamp |
| `updatedAt` | number | ✅ | - | - | Last update timestamp |

**Relationships:**
- `orders` - One-to-many link to orders
- `draftOrders` - One-to-many link to draft orders
- `conversations` - One-to-many link to conversations

---

### conversations

AI conversation sessions.

| Attribute | Type | Required | Indexed | Unique | Description |
|-----------|------|----------|---------|--------|-------------|
| `id` | UUID | ✅ | - | ✅ | Auto-generated conversation ID |
| `userId` | string | ✅ | ✅ | - | User who started conversation |
| `title` | string | - | - | - | Conversation title/summary |
| `context` | json | - | - | - | Conversation context metadata |
| `createdAt` | number | ✅ | - | - | Conversation start timestamp |
| `updatedAt` | number | ✅ | - | - | Last message timestamp |

**Relationships:**
- `user` - Many-to-one link to user
- `messages` - One-to-many link to agent memory

---

### agentMemory

AI conversation message history.

| Attribute | Type | Required | Indexed | Unique | Description |
|-----------|------|----------|---------|--------|-------------|
| `id` | UUID | ✅ | - | ✅ | Auto-generated message ID |
| `userId` | string | ✅ | ✅ | - | User who owns this message |
| `role` | string | ✅ | - | - | 'user' or 'assistant' |
| `content` | string | ✅ | - | - | Message content |
| `metadata` | json | - | - | - | Additional metadata |
| `createdAt` | number | ✅ | - | - | Message timestamp |

**Relationships:**
- `conversation` - Many-to-one link to conversation

---

## Relationship Graph

```
providers
  ├─► products (one-to-many)
  ├─► orders (one-to-many)
  └─► draftOrders (one-to-many)

products
  ├─◄ provider (many-to-one)
  └─► inventoryItems (one-to-many)

inventoryItems
  └─◄ product (many-to-one)

orders
  ├─◄ provider (many-to-one)
  └─◄ user (many-to-one)

draftOrders
  ├─◄ provider (many-to-one)
  └─◄ user (many-to-one)

users
  ├─► orders (one-to-many)
  ├─► draftOrders (one-to-many)
  └─► conversations (one-to-many)

conversations
  ├─◄ user (many-to-one)
  └─► messages (one-to-many)

agentMemory
  └─◄ conversation (many-to-one)
```

## Indexes

Fields marked with ✅ in the "Indexed" column are optimized for fast queries:

- `users.email` - Unique index for login lookups
- `orders.orderNumber` - Unique index for order tracking
- `orders.userId` - Index for user order history
- `orders.completed` - Index for filtering by status
- `inventoryItems.price` - Index for price range queries
- `inventoryItems.quantity` - Index for stock availability
- `inventoryItems.inStock` - Index for availability filtering
- `conversations.userId` - Index for user conversation history
- `agentMemory.userId` - Index for user message history

## Vector Embeddings (LibSQL)

While not part of InstantDB, vector embeddings are stored in a separate LibSQL database for semantic search:

**Table: embeddings**

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT | Primary key, format: `{productId}_{type}_{timestamp}` |
| `productid` | TEXT | Product UUID from InstantDB |
| `embedding` | BLOB | Float32 vector embedding |
| `content_type` | TEXT | 'product', 'category', or 'tag' |
| `content` | TEXT | Original text that was embedded |
| `model` | TEXT | Embedding model name (e.g., 'text-embedding-004') |
| `created` | INTEGER | Timestamp |

**Note:** This table does NOT have a foreign key to products (they're in InstantDB, not LibSQL).

## Usage Examples

See [InstantDB Operations](./operations.md) for complete CRUD examples.

## Schema Files

- **InstantDB Schema**: `src/db/instantdb-schema.ts`
- **CLI Schema**: `instant.schema.ts`
- **LibSQL Schema**: `src/db/schema.ts`
- **Push InstantDB Schema**: `npx instant-cli push schema --yes`
- **Reset LibSQL Embeddings**: `npx tsx reset-embeddings.ts`
