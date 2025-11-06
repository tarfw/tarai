#!/usr/bin/env tsx

/**
 * Verification script to check if embeddings are stored correctly in Turso
 */

import "dotenv/config";
import { CommerceDB, commerceDb } from "./db";

async function verifyEmbeddings() {
  console.log("🔍 Verifying embeddings in Turso database...\n");

  try {
    // Check products table
    const products = await CommerceDB.searchProducts("", undefined, 100);
    console.log(`📦 Found ${products.length} products in database`);

    // Check embeddings table
    const embeddings = await CommerceDB.getProductEmbeddings("prod-001");
    console.log(`🧠 Found ${embeddings.length} embeddings for product prod-001`);

    if (embeddings.length > 0) {
      console.log("✅ Embeddings are stored correctly!");
      console.log(`   - Content: "${String(embeddings[0].content).substring(0, 50)}..."`);
      console.log(`   - Content Type: ${embeddings[0].contentType}`);
      console.log(`   - Model: ${embeddings[0].model}`);
      console.log(`   - Embedding Length: ${embeddings[0].embedding.length} dimensions`);
      console.log(`   - Created: ${new Date(Number(embeddings[0].created) || 0).toLocaleString()}`);
    } else {
      console.log("❌ No embeddings found for product prod-001");
    }

    // Check total embeddings count
    const allEmbeddings = await commerceDb.execute(`
      SELECT COUNT(*) as count FROM embeddings
    `);
    const totalEmbeddings = (allEmbeddings.rows[0] as any).count;
    console.log(`📊 Total embeddings in database: ${totalEmbeddings}`);

    // Test vector search
    console.log("\n🔍 Testing vector search...");
    const { generateEmbedding } = await import("./utils/embeddings");
    const queryEmbedding = await generateEmbedding("fresh bread");

    const vectorResults = await CommerceDB.vectorSearchProducts(
      queryEmbedding,
      undefined,
      5,
      0.5
    );

    console.log(`🎯 Found ${vectorResults.length} products via vector search`);
    if (vectorResults.length > 0) {
      console.log("✅ Vector search is working!");
      vectorResults.forEach((result, i) => {
        console.log(`   ${i + 1}. ${result.name} (similarity: ${(result.similarity as number).toFixed(3)})`);
      });
    }

    // Test hybrid search
    console.log("\n🔎 Testing hybrid search...");
    const hybridResults = await CommerceDB.hybridSearchProducts(
      "bread",
      queryEmbedding,
      undefined,
      5
    );

    console.log(`🎯 Found ${hybridResults.length} products via hybrid search`);
    if (hybridResults.length > 0) {
      console.log("✅ Hybrid search is working!");
      hybridResults.forEach((result, i) => {
        console.log(`   ${i + 1}. ${result.name} (score: ${(result.combinedScore as number).toFixed(3)})`);
      });
    }

  } catch (error) {
    console.error("❌ Verification failed:", error);
    process.exit(1);
  }
}

// Run verification if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  verifyEmbeddings();
}

export { verifyEmbeddings };
