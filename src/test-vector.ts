#!/usr/bin/env tsx

/**
 * Test vector operations in Turso
 */

import "dotenv/config";
import { commerceDb } from "./db";

async function testVectorOperations() {
  console.log("🧠 Testing vector operations...\n");

  try {
    // Test basic vector distance function
    console.log("Testing vector_distance_cos function...");

    // Generate a proper embedding using the same model
    const { generateEmbedding } = await import("./utils/embeddings");
    const testEmbedding = await generateEmbedding("test vector search query");
    const buffer = Buffer.from(testEmbedding.buffer.slice(0, testEmbedding.byteLength));

    // Insert test embedding
    await commerceDb.execute({
      sql: `INSERT OR REPLACE INTO embeddings (id, productid, embedding, content, content_type, model, created) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: ['test-embedding', 'test-product', buffer, 'test content', 'product', 'test-model', Date.now()]
    });

    console.log("✅ Test embedding inserted");

    // Try a simple vector distance query
    const results = await commerceDb.execute({
      sql: `SELECT vector_distance_cos(embedding, ?) as distance FROM embeddings WHERE id = ?`,
      args: [buffer, 'test-embedding']
    });

    console.log("✅ Vector distance query successful");
    console.log(`Distance: ${(results.rows[0] as any).distance}`);

    // Test the full vector search query structure
    console.log("\nTesting vector search query structure...");

    const searchResults = await commerceDb.execute({
      sql: `
        SELECT
          e.id,
          vector_distance_cos(e.embedding, ?) as similarity
        FROM embeddings e
        WHERE e.content_type = 'product'
        ORDER BY similarity DESC
        LIMIT ?
      `,
      args: [buffer, 5]
    });

    // Filter results manually
    const filteredResults = searchResults.rows.filter((row: any) => {
      const similarity = row.similarity;
      return similarity !== null && similarity > 0.1;
    });

    console.log(`✅ Vector search query successful: ${searchResults.rows.length} total, ${filteredResults.length} filtered results`);

  } catch (error) {
    console.error("❌ Vector test failed:", error);
  }
}

// Run test directly
testVectorOperations().catch(console.error);

export { testVectorOperations };
