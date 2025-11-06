/**
 * Database schema for the Universal Commerce AI System
 * Includes tables for products, inventory, embeddings, and orders
 */

export const createTablesSQL = `
-- Providers table
CREATE TABLE IF NOT EXISTS providers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  address TEXT,
  active INTEGER DEFAULT 1,
  verified INTEGER DEFAULT 0,
  created INTEGER,
  updated INTEGER
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  providerid TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  tags TEXT, -- JSON array of tags
  images TEXT, -- JSON array of image URLs
  available INTEGER DEFAULT 1,
  featured INTEGER DEFAULT 0,
  created INTEGER,
  updated INTEGER,
  FOREIGN KEY (providerid) REFERENCES providers(id)
);

-- Inventory items table (price and stock per product)
CREATE TABLE IF NOT EXISTS inventoryitems (
  id TEXT PRIMARY KEY,
  productid TEXT NOT NULL,
  variant_name TEXT,
  price REAL NOT NULL,
  quantity INTEGER DEFAULT 0,
  reserved INTEGER DEFAULT 0,
  instock INTEGER DEFAULT 1,
  created INTEGER,
  updated INTEGER,
  FOREIGN KEY (productid) REFERENCES products(id)
);

-- Embeddings table for semantic search
CREATE TABLE IF NOT EXISTS embeddings (
  id TEXT PRIMARY KEY,
  productid TEXT NOT NULL,
  embedding BLOB NOT NULL, -- Vector embeddings (float32 array)
  content_type TEXT DEFAULT 'product', -- 'product', 'category', 'tag'
  content TEXT, -- Original text that was embedded
  model TEXT DEFAULT 'text-embedding-004', -- Embedding model used
  created INTEGER,
  FOREIGN KEY (productid) REFERENCES products(id)
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  ordernumber TEXT UNIQUE NOT NULL,
  userid TEXT NOT NULL,
  providerid TEXT NOT NULL,
  items TEXT NOT NULL, -- JSON array of order items
  subtotal REAL NOT NULL,
  tax REAL NOT NULL,
  discount REAL DEFAULT 0,
  total REAL NOT NULL,
  paid INTEGER DEFAULT 0,
  completed INTEGER DEFAULT 0,
  notes TEXT,
  created INTEGER,
  updated INTEGER,
  FOREIGN KEY (providerid) REFERENCES providers(id)
);

-- Draft orders (temporary, local to device)
CREATE TABLE IF NOT EXISTS draftorders (
  id TEXT PRIMARY KEY,
  ordernumber TEXT,
  userid TEXT NOT NULL,
  providerid TEXT NOT NULL,
  items TEXT NOT NULL, -- JSON array of cart items
  subtotal REAL NOT NULL,
  tax REAL NOT NULL,
  discount REAL DEFAULT 0,
  total REAL NOT NULL,
  paid INTEGER DEFAULT 0,
  created INTEGER,
  updated INTEGER
);

-- User sessions/memory
CREATE TABLE IF NOT EXISTS agentmemory (
  id TEXT PRIMARY KEY,
  userid TEXT NOT NULL,
  conversationid TEXT NOT NULL,
  role TEXT NOT NULL, -- 'user' or 'assistant'
  content TEXT NOT NULL,
  metadata TEXT, -- JSON metadata
  created INTEGER,
  FOREIGN KEY (userid) REFERENCES users(id),
  FOREIGN KEY (conversationid) REFERENCES conversations(id)
);

-- Conversations
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  userid TEXT NOT NULL,
  title TEXT,
  context TEXT, -- JSON context about the conversation
  created INTEGER,
  updated INTEGER,
  FOREIGN KEY (userid) REFERENCES users(id)
);

-- Users (for customer accounts)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT UNIQUE,
  phone TEXT,
  active INTEGER DEFAULT 1,
  created INTEGER,
  updated INTEGER
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_provider ON products(providerid);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_available ON products(available);
CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventoryitems(productid);
CREATE INDEX IF NOT EXISTS idx_inventory_instock ON inventoryitems(instock);
CREATE INDEX IF NOT EXISTS idx_embeddings_product ON embeddings(productid);
CREATE INDEX IF NOT EXISTS idx_orders_provider ON orders(providerid);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(userid);
CREATE INDEX IF NOT EXISTS idx_orders_completed ON orders(completed);
CREATE INDEX IF NOT EXISTS idx_agentmemory_conversation ON agentmemory(conversationid);
CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(userid);
`;

// Initialize database with schema (creates tables if they don't exist)
export const initializeDatabase = async (db: any) => {
	try {
		// Create tables if they don't exist (preserves existing data)
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
			"Database schema initialized successfully (existing data preserved)",
		);
	} catch (error) {
		console.error("Failed to initialize database schema:", error);
		throw error;
	}
};

// Reset database (drops all tables and recreates them - USE WITH CAUTION)
export const resetDatabase = async (db: any) => {
	try {
		console.log("⚠️  RESETTING DATABASE - ALL DATA WILL BE LOST!");

		// Drop existing tables
		const dropTablesSQL = `
      DROP TABLE IF EXISTS embeddings;
      DROP TABLE IF EXISTS inventoryitems;
      DROP TABLE IF EXISTS products;
      DROP TABLE IF EXISTS providers;
      DROP TABLE IF EXISTS orders;
      DROP TABLE IF EXISTS draftorders;
      DROP TABLE IF EXISTS agentmemory;
      DROP TABLE IF EXISTS conversations;
      DROP TABLE IF EXISTS users;
    `;

		const dropStatements = dropTablesSQL
			.split(";")
			.map((stmt) => stmt.trim())
			.filter((stmt) => stmt.length > 0);

		for (const statement of dropStatements) {
			if (statement.trim()) {
				try {
					await db.execute(statement);
				} catch (error) {
					// Ignore errors for tables that don't exist
					console.log(
						`Note: Could not drop table: ${statement.split(" ")[4] || "unknown"}`,
					);
				}
			}
		}

		// Recreate tables
		const createStatements = createTablesSQL
			.split(";")
			.map((stmt) => stmt.trim())
			.filter((stmt) => stmt.length > 0);

		for (const statement of createStatements) {
			if (statement.trim()) {
				await db.execute(statement);
			}
		}

		console.log("✅ Database reset complete - all tables recreated");
	} catch (error) {
		console.error("❌ Failed to reset database:", error);
		throw error;
	}
};
