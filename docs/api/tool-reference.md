# API Tool Reference

Complete reference for all available tools in the Universal Commerce AI System.

## Tool Categories

- [Product Search](#product-search)
- [Product Management](#product-management)
- [Inventory Management](#inventory-management)
- [Order Management](#order-management)
- [Provider Management](#provider-management)
- [Embeddings & Search](#embeddings--search)

---

## Product Search

### searchProducts

Search for products using intelligent text or semantic search.

**Use Cases:**
- Find products by name or category
- POS mode (provider-specific search)
- Discovery mode (search all providers)

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | ✅ | - | Search query (product name, category, keywords) |
| `providerId` | string | - | - | Provider ID for POS mode. Omit to search all providers |
| `limit` | number | - | 20 | Maximum number of results |
| `useSemantic` | boolean | - | true | Use semantic/vector search for better results |

**Returns:**

```typescript
{
  success: boolean;
  message: string;
  products: Array<{
    id: string;
    name: string;
    description: string;
    category: string;
    providerId: string;
    providerName: string;
    price: number;
    quantity: number;
    inStock: boolean;
    searchScore?: number;
    searchType: "semantic" | "text";
  }>;
  searchType: "semantic" | "text";
}
```

**Example:**

```json
{
  "query": "coffee beans",
  "providerId": "brewbar-123",
  "limit": 10
}
```

---

### semanticSearch

Perform pure semantic search using natural language understanding.

**Use Cases:**
- Find products by description or concept
- Natural language queries
- Better than keyword matching

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | ✅ | - | Natural language description of what you're looking for |
| `providerId` | string | - | - | Limit results to specific provider |
| `limit` | number | - | 20 | Maximum number of results |
| `similarityThreshold` | number | - | 0.7 | Minimum similarity score (0-1) |

**Returns:**

```typescript
{
  success: boolean;
  message: string;
  products: Array<{
    id: string;
    name: string;
    description: string;
    category: string;
    providerId: string;
    providerName: string;
    price: number;
    quantity: number;
    inStock: boolean;
    similarity: number; // 0-1 similarity score
  }>;
}
```

**Example:**

```json
{
  "query": "fresh baked bread for breakfast",
  "similarityThreshold": 0.6
}
```

---

### getProductDetails

Get detailed information about a specific product.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `productId` | string | ✅ | Product UUID |

**Returns:**

```typescript
{
  success: boolean;
  product: {
    id: string;
    name: string;
    description: string;
    category: string;
    providerId: string;
    providerName: string;
    price: number;
    quantity: number;
    inStock: boolean;
    created: number;
    updated: number;
  };
}
```

---

## Product Management

### createProduct

Create a new product with associated inventory item.

**Use Cases:**
- Add new products to catalog
- Set initial pricing and quantity
- Support product variants

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `providerId` | string | ✅ | Provider UUID |
| `name` | string | ✅ | Product name |
| `description` | string | - | Product description |
| `category` | string | ✅ | Product category |
| `tags` | string[] | - | Array of tags |
| `price` | number | ✅ | Price (in currency units) |
| `quantity` | number | ✅ | Initial stock quantity |
| `variantName` | string | - | Variant name (e.g., "Large", "Blue") |

**Returns:**

```typescript
{
  success: boolean;
  message: string;
  product: {
    id: string;
    inventoryId: string;
    name: string;
    price: number;
    quantity: number;
  };
}
```

**Example:**

```json
{
  "providerId": "brewbar-123",
  "name": "Ethiopian Yirgacheffe",
  "description": "Single-origin coffee beans",
  "category": "Coffee",
  "tags": ["organic", "fair-trade"],
  "price": 18.99,
  "quantity": 50
}
```

---

### updateProduct

Update existing product information.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `productId` | string | ✅ | Product UUID |
| `name` | string | - | New product name |
| `description` | string | - | New description |
| `category` | string | - | New category |
| `tags` | string[] | - | New tags array |
| `available` | boolean | - | Availability status |

**Returns:**

```typescript
{
  success: boolean;
  message: string;
}
```

---

### bulkCreateProducts

Create multiple products at once for a provider.

**Use Cases:**
- Import product catalog
- Initial setup
- Bulk operations

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `providerId` | string | ✅ | Provider UUID |
| `products` | array | ✅ | Array of product objects |

**Product Object:**

```typescript
{
  name: string;
  description?: string;
  category: string;
  tags?: string[];
  price: number;
  quantity: number;
  variantName?: string;
}
```

**Returns:**

```typescript
{
  success: boolean;
  message: string;
  results: Array<{
    success: boolean;
    productId?: string;
    inventoryId?: string;
    productName?: string;
    error?: string;
  }>;
}
```

**Example:**

```json
{
  "providerId": "brewbar-123",
  "products": [
    {
      "name": "Espresso Blend",
      "category": "Coffee",
      "price": 16.99,
      "quantity": 100
    },
    {
      "name": "House Blend",
      "category": "Coffee",
      "price": 14.99,
      "quantity": 150
    }
  ]
}
```

---

## Inventory Management

### checkInventory

Check if sufficient inventory is available for a product.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `productId` | string | ✅ | Product UUID |
| `quantity` | number | ✅ | Requested quantity |

**Returns:**

```typescript
{
  success: boolean;
  available: boolean;
  message: string;
  inventory: {
    productId: string;
    currentQuantity: number;
    requestedQuantity: number;
    inStock: boolean;
  };
}
```

---

### updateInventory

Update product inventory quantity.

**Use Cases:**
- Restock inventory
- Adjust for damage/loss
- Inventory corrections

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `productId` | string | ✅ | Product UUID |
| `quantityChange` | number | ✅ | Change in quantity (positive or negative) |

**Returns:**

```typescript
{
  success: boolean;
  message: string;
  inventory: {
    productId: string;
    oldQuantity: number;
    newQuantity: number;
    change: number;
  };
}
```

**Example:**

```json
{
  "productId": "prod-123",
  "quantityChange": 50  // Add 50 units
}
```

```json
{
  "productId": "prod-123",
  "quantityChange": -10  // Remove 10 units
}
```

---

## Order Management

### createOrder

Create a new customer order.

**Use Cases:**
- Process customer purchase
- Record sale
- Track orders

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` | string | ✅ | Customer user ID |
| `providerId` | string | ✅ | Provider UUID |
| `items` | array | ✅ | Array of order items |
| `notes` | string | - | Order notes |

**Order Item:**

```typescript
{
  productId: string;
  productName: string;
  quantity: number;
  price: number;
}
```

**Returns:**

```typescript
{
  success: boolean;
  message: string;
  order: {
    id: string;
    orderNumber: string;
    items: OrderItem[];
    subtotal: number;
    tax: number;
    discount: number;
    total: number;
  };
}
```

**Example:**

```json
{
  "userId": "user-123",
  "providerId": "brewbar-123",
  "items": [
    {
      "productId": "prod-456",
      "productName": "Ethiopian Coffee",
      "quantity": 2,
      "price": 18.99
    }
  ],
  "notes": "Customer requested gift wrapping"
}
```

---

## Provider Management

### createProvider

Create a new provider/vendor.

**Use Cases:**
- Onboard new vendors
- Set up business accounts
- Provider registration

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | ✅ | Business name |
| `description` | string | - | Business description |
| `contactEmail` | string | - | Contact email (validated) |
| `contactPhone` | string | - | Contact phone number |
| `address` | string | - | Business address |

**Returns:**

```typescript
{
  success: boolean;
  message: string;
  provider: {
    id: string;
    name: string;
    active: boolean;
    verified: boolean;
  };
}
```

**Example:**

```json
{
  "name": "Brewbar Coffee",
  "description": "Artisan coffee roasters",
  "contactEmail": "contact@brewbar.com",
  "contactPhone": "+1-555-0100",
  "address": "123 Main St, Seattle, WA"
}
```

---

## Embeddings & Search

### generateEmbeddings

Generate vector embeddings for all products to enable semantic search.

**Use Cases:**
- Initial setup
- After bulk product import
- Refresh embeddings

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `regenerate` | boolean | - | Force regeneration of existing embeddings |

**Returns:**

```typescript
{
  success: boolean;
  message: string;
  stats: {
    total: number;
    generated: number;
    skipped: number;
  };
}
```

**Note:** This operation can take time for large catalogs. Embeddings are stored in LibSQL for fast vector similarity search.

---

## Error Handling

All tools return consistent error responses:

```typescript
{
  success: false,
  error: string,
  message: string
}
```

**Common Errors:**

- `Product not found` - Invalid product ID
- `Provider not found` - Invalid provider ID
- `Insufficient inventory` - Not enough stock
- `Validation error` - Invalid parameters
- `Database error` - Database operation failed

---

## Usage Examples

### Commerce Agent Conversation

```
User: "Find me all coffee products"
Agent: Uses searchProductsTool with query="coffee"

User: "Add 50 units to the Ethiopian Coffee"
Agent: Uses updateInventoryTool with productId and quantityChange=50

User: "Create an order for user-123 with 2 Ethiopian Coffee"
Agent:
1. Uses checkInventoryTool to verify stock
2. Uses createOrderTool to process the order
```

### Direct API Call

```bash
curl -X POST http://localhost:4310/api/agents/commerce/messages \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Search for coffee products",
    "userId": "user-123"
  }'
```

---

## Next Steps

- [System Overview](../architecture/system-overview.md)
- [Quick Start Guide](../development/quick-start.md)
- [VoltAgent Framework](../voltagent/framework-overview.md)
