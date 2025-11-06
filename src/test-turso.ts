#!/usr/bin/env tsx

/**
 * Test TURSO database connection
 */

import "dotenv/config";
import { commerceDb } from "./db";

async function testTursoConnection() {
  console.log("🔗 Testing TURSO database connection...\n");

  try {
    // Test basic connection
    const result = await commerceDb.execute("SELECT 1 as test");
    console.log("✅ TURSO connection successful!");
    console.log(`   Database URL: ${process.env.TURSO_DATABASE_URL}`);

    // Test table creation (if not exists)
    await commerceDb.execute("CREATE TABLE IF NOT EXISTS test_connection (id INTEGER PRIMARY KEY, message TEXT)");
    console.log("✅ Table creation successful!");

    // Insert test data
    await commerceDb.execute("INSERT INTO test_connection (message) VALUES (?)", ["TURSO connection test successful!"]);
    console.log("✅ Data insertion successful!");

    // Query test data
    const queryResult = await commerceDb.execute("SELECT * FROM test_connection ORDER BY id DESC LIMIT 1");
    console.log("✅ Data query successful!");
    console.log(`   Test message: "${(queryResult.rows[0] as any).message}"`);

    console.log("\n🎉 TURSO database is ready for your commerce AI system!");

  } catch (error) {
    console.error("❌ TURSO connection failed:");
    console.error(error);
    console.log("\n🔧 Troubleshooting:");
    console.log("1. Check your TURSO_DATABASE_URL in .env");
    console.log("2. Check your TURSO_AUTH_TOKEN in .env");
    console.log("3. Make sure your TURSO database is active");
    console.log("4. Verify your IP is allowed in TURSO dashboard");
    process.exit(1);
  }
}

// Run test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testTursoConnection();
}

export { testTursoConnection };
