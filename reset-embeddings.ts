/**
 * Reset Embeddings Table
 * Drops and recreates the embeddings table without foreign key constraint
 * Run this once after fixing the schema
 *
 * Usage: npx tsx reset-embeddings.ts
 */

import "dotenv/config";
import { commerceDb } from "./src/db";

async function resetEmbeddingsTable() {
	try {
		console.log("🔄 Resetting embeddings table...");

		// Drop existing table
		console.log("⚠️  Dropping old embeddings table (with foreign key constraint)...");
		await commerceDb.execute("DROP TABLE IF EXISTS embeddings");
		console.log("✅ Old table dropped");

		// Recreate without foreign key
		console.log("📝 Creating new embeddings table (without foreign key)...");
		await commerceDb.execute(`
			CREATE TABLE IF NOT EXISTS embeddings (
				id TEXT PRIMARY KEY,
				productid TEXT NOT NULL,
				embedding BLOB NOT NULL,
				content_type TEXT DEFAULT 'product',
				content TEXT,
				model TEXT DEFAULT 'text-embedding-004',
				created INTEGER
			)
		`);
		console.log("✅ New table created");

		// Create index
		console.log("📊 Creating index...");
		await commerceDb.execute(
			"CREATE INDEX IF NOT EXISTS idx_embeddings_product ON embeddings(productid)"
		);
		console.log("✅ Index created");

		console.log("\n🎉 Embeddings table reset successfully!");
		console.log("   You can now run: npm run dev");
		console.log("   And use: 'Generate embeddings for all products'");

		process.exit(0);
	} catch (error) {
		console.error("❌ Failed to reset embeddings table:", error);
		process.exit(1);
	}
}

resetEmbeddingsTable();
