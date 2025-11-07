# Complete System Walkthrough - Examples

This guide provides step-by-step examples for all common operations in the Universal Commerce AI System.

## Prerequisites

- Server running at `http://localhost:4310`
- InstantDB schema pushed
- Environment variables configured

## Example 1: Complete Setup from Scratch

### Step 1: Create a Provider

**Via VoltOps Console:**

```
Create a new provider named "Brewbar Coffee" with description "Artisan coffee roasters",
email "contact@brewbar.com", phone "+1-555-0100", address "123 Main St, Seattle, WA"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Provider 'Brewbar Coffee' created successfully",
  "provider": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Brewbar Coffee",
    "active": true,
    "verified": false
  }
}
```

**Save the provider ID** - you'll need it for creating products!

---

### Step 2: Create Products for the Provider

Now that you have a provider ID, create products:

**Via VoltOps Console:**

```
Create a product for provider 550e8400-e29b-41d4-a716-446655440000:
- Name: Ethiopian Yirgacheffe
- Description: Single-origin coffee beans with floral notes
- Category: Coffee
- Price: 18.99
- Quantity: 50
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Product 'Ethiopian Yirgacheffe' created successfully",
  "product": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "inventoryId": "789e0123-e89b-12d3-a456-426614174000",
    "name": "Ethiopian Yirgacheffe",
    "price": 18.99,
    "quantity": 50
  }
}
```

---

### Step 3: Create More Products (Bulk)

**Via VoltOps Console:**

```
Create multiple products for provider 550e8400-e29b-41d4-a716-446655440000:

1. Colombian Supremo, Coffee category, price 16.99, quantity 75
2. House Blend, Coffee category, price 14.99, quantity 100
3. Espresso Roast, Coffee category, price 15.99, quantity 60
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Created 3 products successfully",
  "results": [
    {
      "success": true,
      "productId": "...",
      "inventoryId": "..."
    },
    // ... more results
  ]
}
```

---

### Step 4: Generate Embeddings for Semantic Search

**Via VoltOps Console:**

```
Generate embeddings for all products
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Embeddings generation complete",
  "stats": {
    "total": 4,
    "generated": 4,
    "skipped": 0
  }
}
```

This enables semantic search capabilities!

---

### Step 5: Search Products

**Text Search:**
```
Search for coffee products
```

**Semantic Search:**
```
Find me breakfast beverages with a bold flavor
```

---

### Step 6: Check Inventory

```
Check inventory for product 123e4567-e89b-12d3-a456-426614174000, quantity 10
```

**Expected Response:**
```json
{
  "success": true,
  "available": true,
  "message": "10 units available",
  "inventory": {
    "productId": "123e4567-e89b-12d3-a456-426614174000",
    "currentQuantity": 50,
    "requestedQuantity": 10,
    "inStock": true
  }
}
```

---

### Step 7: Create an Order

```
Create an order for user user-123, provider 550e8400-e29b-41d4-a716-446655440000:
- Product 123e4567-e89b-12d3-a456-426614174000 (Ethiopian Yirgacheffe), quantity 2, price 18.99
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Order ORD-1234567890 created successfully",
  "order": {
    "id": "...",
    "orderNumber": "ORD-1234567890",
    "items": [...],
    "subtotal": 37.98,
    "tax": 6.84,
    "discount": 0,
    "total": 44.82
  }
}
```

---

## Example 2: Using Direct API Calls

### Create Provider via API

```bash
curl -X POST http://localhost:4310/api/agents/commerce/messages \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Create a provider named \"Artisan Bakery\" with email \"info@artisanbakery.com\"",
    "userId": "admin-user",
    "conversationId": "setup-session"
  }'
```

### Create Product via API

```bash
curl -X POST http://localhost:4310/api/agents/commerce/messages \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Create product for provider 550e8400-e29b-41d4-a716-446655440000: Sourdough Bread, Bakery category, price 8.99, quantity 20",
    "userId": "admin-user",
    "conversationId": "setup-session"
  }'
```

### Search Products via API

```bash
curl -X POST http://localhost:4310/api/agents/commerce/messages \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Search for bread products",
    "userId": "customer-123",
    "conversationId": "shopping-session"
  }'
```

---

## Example 3: Multi-Vendor Setup

### Create Multiple Providers

```
Create provider "Brewbar Coffee", description "Artisan coffee roasters"
```

```
Create provider "Fresh Bakery", description "Daily fresh bread and pastries"
```

```
Create provider "Green Market", description "Organic produce and goods"
```

### Add Products for Each Provider

**For Brewbar Coffee (provider-id-1):**
```
Create products for provider [provider-id-1]:
1. Ethiopian Coffee, Coffee, 18.99, 50
2. Colombian Coffee, Coffee, 16.99, 75
```

**For Fresh Bakery (provider-id-2):**
```
Create products for provider [provider-id-2]:
1. Sourdough Bread, Bakery, 8.99, 30
2. Croissant, Bakery, 3.99, 50
```

**For Green Market (provider-id-3):**
```
Create products for provider [provider-id-3]:
1. Organic Avocados, Produce, 4.99, 100
2. Fresh Spinach, Produce, 2.99, 80
```

### Generate Embeddings

```
Generate embeddings for all products
```

### Search Across All Providers (Discovery Mode)

```
Find me breakfast items
```

This will return results from all providers!

### Search Single Provider (POS Mode)

```
Search for products from provider [provider-id-1]
```

This returns only Brewbar Coffee products.

---

## Example 4: Inventory Management

### Check Current Inventory

```
Get product details for 123e4567-e89b-12d3-a456-426614174000
```

### Add Stock

```
Update inventory for product 123e4567-e89b-12d3-a456-426614174000, add 25 units
```

Or more naturally:
```
Add 25 units to Ethiopian Coffee inventory
```

### Remove Stock (Damage/Loss)

```
Update inventory for product 123e4567-e89b-12d3-a456-426614174000, remove 5 units
```

### Verify Stock Before Order

```
Check if 10 units of product 123e4567-e89b-12d3-a456-426614174000 are available
```

---

## Example 5: Complete Order Flow

### Step 1: Customer Searches

```
Find me coffee beans under $20
```

### Step 2: Check Availability

```
Check inventory for product 123e4567-e89b-12d3-a456-426614174000, quantity 2
```

### Step 3: Create Order

```
Create order for user customer-456, provider 550e8400-e29b-41d4-a716-446655440000:
- Product 123e4567-e89b-12d3-a456-426614174000, Ethiopian Yirgacheffe, quantity 2, price 18.99
```

### Step 4: Verify Order

```
Get order details for ORD-1234567890
```

---

## Example 6: Semantic Search Examples

After generating embeddings, try these natural language queries:

### Find by Description

```
Find me smooth breakfast coffee with chocolate notes
```

### Find by Use Case

```
I need something for making espresso at home
```

### Find by Quality

```
Show me premium single-origin coffee beans
```

### Find by Mood/Occasion

```
What do you have for a cozy morning?
```

---

## Example 7: Common Conversation Flows

### Customer Shopping Flow

```
Customer: "Hi, what coffee do you have?"
Agent: [Shows available coffee products]

Customer: "Tell me about the Ethiopian one"
Agent: [Shows product details]

Customer: "I'll take 2 pounds"
Agent: [Creates order]
```

### Merchant Management Flow

```
Merchant: "I need to add new products"
Agent: [Gets provider ID if needed]

Merchant: "Add Sumatra Coffee, $19.99, 30 units"
Agent: [Creates product]

Merchant: "Generate embeddings so customers can find it"
Agent: [Generates embeddings]
```

### Inventory Management Flow

```
Manager: "Show me low stock items"
Agent: [Searches for products with quantity < 10]

Manager: "Add 50 units to Ethiopian Coffee"
Agent: [Updates inventory]

Manager: "Verify it's in stock now"
Agent: [Checks inventory status]
```

---

## Example 8: Troubleshooting Common Issues

### Issue: "Missing providerId"

❌ Wrong:
```
Create product: Ethiopian Coffee, Coffee, 18.99, 50
```

✅ Correct:
```
Create product for provider 550e8400-e29b-41d4-a716-446655440000:
Ethiopian Coffee, Coffee category, price 18.99, quantity 50
```

### Issue: "Product not found"

Make sure you're using the full UUID:

❌ Wrong:
```
Check inventory for ethiopian-coffee
```

✅ Correct:
```
Check inventory for product 123e4567-e89b-12d3-a456-426614174000
```

### Issue: "No search results"

1. **Generate embeddings first:**
   ```
   Generate embeddings for all products
   ```

2. **Then search:**
   ```
   Find me coffee products
   ```

---

## Example 9: Testing the System

### Quick Health Check

1. **Test server:**
   ```bash
   curl http://localhost:4310/health
   ```

2. **Test agent:**
   ```
   Hello
   ```

3. **Test database:**
   ```
   Create a test provider named "Test Shop"
   ```

4. **Test cleanup:**
   Visit InstantDB dashboard and delete test data.

### Performance Test

1. **Create multiple products:**
   ```
   Create 10 test products for provider [id]
   ```

2. **Generate embeddings:**
   ```
   Generate embeddings for all products
   ```

3. **Test search:**
   ```
   Search for test products
   ```

4. **Measure response time:**
   Should respond within 1-2 seconds for semantic search.

---

## Example 10: Production Data Setup

### Initial Catalog Import

1. **Create providers:**
   ```
   Create provider "Main Store", email "store@example.com"
   ```

2. **Bulk import products:**
   ```
   Create products for provider [id]:
   1. Product A, Category X, 10.99, 100
   2. Product B, Category X, 12.99, 150
   ... (continue for all products)
   ```

3. **Generate embeddings once:**
   ```
   Generate embeddings for all products
   ```

4. **Verify setup:**
   ```
   Search for [category] products
   ```

---

## Next Steps

- Try these examples in VoltOps Console: [console.voltagent.dev](https://console.voltagent.dev)
- Review [API Reference](../api/tool-reference.md) for all available tools
- Check [Troubleshooting Guide](../development/troubleshooting.md) if you encounter issues
- Build a frontend using [InstantDB React SDK](https://www.instantdb.com/docs)

## Important Tips

1. **Always create provider first** before creating products
2. **Save provider IDs** - you'll need them for products and orders
3. **Generate embeddings** after adding products for semantic search
4. **Use full UUIDs** - don't use custom IDs or names
5. **Check inventory** before creating orders
6. **Be specific** in your requests to the agent
7. **Include all required parameters** in your requests

## Quick Reference

| Operation | Required Info |
|-----------|---------------|
| Create Provider | Name (email, phone, address optional) |
| Create Product | providerId, name, category, price, quantity |
| Search Products | query (providerId optional for POS mode) |
| Check Inventory | productId, quantity |
| Update Inventory | productId, quantityChange (+/-) |
| Create Order | userId, providerId, items array |
| Generate Embeddings | None (processes all products) |
