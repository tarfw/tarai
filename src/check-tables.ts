#!/usr/bin/env tsx

/**
 * Check database tables and schema
 */

import "dotenv/config";
import { commerceDb } from "./db";

async function checkTables() {
  console.log("🔍 Checking database tables...\n");

  try {
    console.log("Connecting to database...");
    // Check all tables and virtual tables
    const tablesResult = await commerceDb.execute(`
      SELECT name, type FROM sqlite_master
      WHERE type IN ('table', 'view', 'index')
      ORDER BY name
    `);

    console.log("📋 Objects in database:");
    tablesResult.rows.forEach((row: any) => {
      console.log(`   - ${row.name} (${row.type})`);
    });

    console.log("\n");

    // Check embeddings table schema
    if (tablesResult.rows.some((row: any) => row.name === 'embeddings')) {
      console.log("🧠 Checking embeddings table schema...");
      const schemaResult = await commerceDb.execute("PRAGMA table_info(embeddings)");
      console.log("Embeddings table columns:");
      schemaResult.rows.forEach((row: any) => {
        console.log(`   - ${row.name}: ${row.type}`);
      });
    } else {
      console.log("❌ Embeddings table not found!");
    }

    // Check if there are any products
    const productsResult = await commerceDb.execute("SELECT COUNT(*) as count FROM products");
    console.log(`📦 Products in database: ${(productsResult.rows[0] as any).count}`);

    // Check if there are any embeddings
    const embeddingsResult = await commerceDb.execute("SELECT COUNT(*) as count FROM embeddings");
    console.log(`🧠 Embeddings in database: ${(embeddingsResult.rows[0] as any).count}`);

  } catch (error) {
    console.error("❌ Error checking tables:", error);
  }
}

// Run check directly
checkTables().catch(console.error);

export { checkTables };
