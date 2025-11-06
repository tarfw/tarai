#!/usr/bin/env tsx

/**
 * Complete database reset script
 */

import "dotenv/config";
import { commerceDb } from "./db";

async function resetDatabase() {
  console.log("🔄 Completely resetting database...\n");

  try {
    // Get all tables, views, and indexes
    const objectsResult = await commerceDb.execute(`
      SELECT name, type FROM sqlite_master
      WHERE type IN ('table', 'view', 'index') AND name NOT LIKE 'sqlite_%'
    `);

    console.log("Dropping existing objects:");
    for (const obj of objectsResult.rows) {
      try {
        await commerceDb.execute(`DROP ${obj.type.toUpperCase()} IF EXISTS ${obj.name}`);
        console.log(`   ✓ Dropped ${obj.type}: ${obj.name}`);
      } catch (error) {
        console.log(`   ⚠️  Could not drop ${obj.type}: ${obj.name} - ${error.message}`);
      }
    }

    console.log("\n✅ Database reset complete!");
    console.log("Now run 'npm run setup' to recreate the schema.");

  } catch (error) {
    console.error("❌ Error resetting database:", error);
  }
}

// Run reset if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  resetDatabase();
}

export { resetDatabase };
