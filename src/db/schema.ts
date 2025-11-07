/**
 * Database schema for LibSQL/Turso - Vector Embeddings Only
 * All CRUD operations (products, inventory, orders, providers) are now in InstantDB
 * This schema only handles vector embeddings for semantic search
 */

export const createTablesSQL = `
-- Embeddings table for semantic search (VECTOR OPERATIONS ONLY)
-- Note: productid references products in InstantDB, not LibSQL
CREATE TABLE IF NOT EXISTS embeddings (
  id TEXT PRIMARY KEY,
  productid TEXT NOT NULL,
  embedding BLOB NOT NULL, -- Vector embeddings (float32 array)
  content_type TEXT DEFAULT 'product', -- 'product', 'category', 'tag'
  content TEXT, -- Original text that was embedded
  model TEXT DEFAULT 'text-embedding-004', -- Embedding model used
  created INTEGER
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_embeddings_product ON embeddings(productid);
`;

// Initialize database with schema (creates embeddings table only)
export const initializeDatabase = async (db: any) => {
	try {
		// Create embeddings table if it doesn't exist (preserves existing data)
		const createStatements = createTablesSQL
			.split(";")
			.map((stmt) => stmt.trim())
			.filter((stmt) => stmt.length > 0);

		for (const statement of createStatements) {
			if (statement.trim()) {
				await db.execute(statement);
			}
		}

		console.log(
			"✅ Vector embeddings table initialized (LibSQL) - existing embeddings preserved",
		);
	} catch (error) {
		console.error("Failed to initialize embeddings table:", error);
		throw error;
	}
};

// Reset embeddings table (drops and recreates embeddings - USE WITH CAUTION)
export const resetDatabase = async (db: any) => {
	try {
		console.log(
			"⚠️  RESETTING EMBEDDINGS TABLE - ALL VECTOR DATA WILL BE LOST!",
		);
		console.log(
			"Note: CRUD data (products, orders, etc.) is in InstantDB and won't be affected",
		);

		// Drop embeddings table
		await db.execute("DROP TABLE IF EXISTS embeddings");

		// Recreate embeddings table
		const createStatements = createTablesSQL
			.split(";")
			.map((stmt) => stmt.trim())
			.filter((stmt) => stmt.length > 0);

		for (const statement of createStatements) {
			if (statement.trim()) {
				await db.execute(statement);
			}
		}

		console.log("✅ Embeddings table reset complete");
	} catch (error) {
		console.error("❌ Failed to reset embeddings table:", error);
		throw error;
	}
};
