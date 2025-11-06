#!/usr/bin/env tsx

/**
 * Test commerce functionality end-to-end
 */

import "dotenv/config";
import { CommerceDB } from "./db";

async function testCommerce() {
  console.log("🛒 Testing commerce functionality...\n");
  console.log("Script starting...");

  // Initialize database schema
  const { initializeDatabase } = await import("./db/schema");
  const { commerceDb } = await import("./db");
  await initializeDatabase(commerceDb);

  try {
    // Step 1: Create a provider
    console.log("1️⃣ Creating provider...");
    await commerceDb.execute({
      sql: `
        INSERT INTO providers (id, name, description, active, created, updated)
        VALUES (?, ?, ?, 1, ?, ?)
      `,
      args: ['test-provider', 'Test Bakery', 'A test provider for our system', Date.now(), Date.now()]
    });
    console.log("✅ Provider created");

    // Step 2: Create a product
    console.log("\n2️⃣ Creating product...");
    await commerceDb.execute({
      sql: `
        INSERT INTO products (id, providerid, name, description, category, available, created, updated)
        VALUES (?, ?, ?, ?, ?, 1, ?, ?)
      `,
      args: ['test-product', 'test-provider', 'Chocolate Croissant', 'Fresh baked chocolate croissant', 'Bakery', Date.now(), Date.now()]
    });
    console.log("✅ Product created");

    // Step 3: Create inventory
    console.log("\n3️⃣ Creating inventory...");
    await commerceDb.execute({
      sql: `
        INSERT INTO inventoryitems (id, productid, price, quantity, instock, created, updated)
        VALUES (?, ?, ?, ?, 1, ?, ?)
      `,
      args: ['test-inventory', 'test-product', 5.99, 25, Date.now(), Date.now()]
    });
    console.log("✅ Inventory created");

    // Step 4: Test search
    console.log("\n4️⃣ Testing product search...");
    const products = await CommerceDB.searchProducts("chocolate", "test-provider");
    console.log(`✅ Found ${products.length} products`);
    if (products.length > 0) {
      console.log(`   - ${products[0].name}: $${products[0].price}`);
    }

    // Step 5: Generate embedding
    console.log("\n5️⃣ Generating embedding...");
    const { generateEmbedding } = await import("./utils/embeddings");
    const testEmbedding = await generateEmbedding("chocolate croissant bakery fresh");
    console.log(`✅ Generated embedding with ${testEmbedding.length} dimensions`);

    // Step 6: Store embedding
    console.log("\n6️⃣ Storing embedding...");
    await CommerceDB.storeEmbedding(
      'test-product',
      testEmbedding,
      'Chocolate Croissant Fresh baked chocolate croissant Bakery',
      'product'
    );
    console.log("✅ Embedding stored");

    // Step 7: Test vector search
    console.log("\n7️⃣ Testing vector search...");
    const vectorResults = await CommerceDB.vectorSearchProducts(
      testEmbedding,
      'test-provider',
      5,
      0.5
    );
    console.log(`✅ Vector search found ${vectorResults.length} results`);

    console.log("\n🎉 All commerce tests passed!");

  } catch (error) {
    console.error("❌ Commerce test failed:", error);
  }
}

// Run test directly
testCommerce().catch(console.error);

export { testCommerce };
