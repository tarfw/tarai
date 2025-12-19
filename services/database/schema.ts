// TARAI Local Database Schema (OP-SQLite)
// All single-word columns as per TARAI.md specification

export const SCHEMA_QUERIES = {
  // User's cached listings with embeddings for offline search
  createMyCacheTable: `
    CREATE TABLE IF NOT EXISTS mycache (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      price REAL NOT NULL,
      description TEXT,
      category TEXT,
      tags TEXT,
      location TEXT,
      thumbnail TEXT,
      status TEXT DEFAULT 'active',
      cached INTEGER NOT NULL
    );
  `,

  createMyCacheEmbeddingIndex: `
    CREATE INDEX IF NOT EXISTS idx_mycache_cached ON mycache(cached);
  `,

  // Migration queries to add new columns to existing tables
  migrations: [
    `ALTER TABLE mycache ADD COLUMN description TEXT;`,
    `ALTER TABLE mycache ADD COLUMN category TEXT;`,
    `ALTER TABLE mycache ADD COLUMN tags TEXT;`,
    `ALTER TABLE mycache ADD COLUMN location TEXT;`,
    `ALTER TABLE mycache ADD COLUMN status TEXT DEFAULT 'active';`,
  ],

  // Browsed items cache (recent views)
  createBrowsedTable: `
    CREATE TABLE IF NOT EXISTS browsed (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      price REAL NOT NULL,
      seller TEXT NOT NULL,
      thumbnail TEXT,
      cached INTEGER NOT NULL
    );
  `,

  createBrowsedIndex: `
    CREATE INDEX IF NOT EXISTS idx_browsed_cached ON browsed(cached);
  `,

  // Search history with timestamps
  createSearchesTable: `
    CREATE TABLE IF NOT EXISTS searches (
      id TEXT PRIMARY KEY,
      query TEXT NOT NULL,
      created INTEGER NOT NULL
    );
  `,

  createSearchesIndex: `
    CREATE INDEX IF NOT EXISTS idx_searches_created ON searches(created);
  `,

  // Offline queue for pending transactions
  createOfflineQueueTable: `
    CREATE TABLE IF NOT EXISTS offlinequeue (
      id TEXT PRIMARY KEY,
      transactiondata TEXT NOT NULL,
      status TEXT NOT NULL,
      retries INTEGER DEFAULT 0,
      created INTEGER NOT NULL,
      synced INTEGER
    );
  `,

  createOfflineQueueIndex: `
    CREATE INDEX IF NOT EXISTS idx_offlinequeue_status ON offlinequeue(status);
  `,
};

export const initializeDatabase = async (db: any) => {
  try {
    console.log('Initializing TARAI local database...');

    // Create tables
    await db.execute(SCHEMA_QUERIES.createMyCacheTable);
    await db.execute(SCHEMA_QUERIES.createBrowsedTable);
    await db.execute(SCHEMA_QUERIES.createSearchesTable);
    await db.execute(SCHEMA_QUERIES.createOfflineQueueTable);

    // Create indexes
    await db.execute(SCHEMA_QUERIES.createMyCacheEmbeddingIndex);
    await db.execute(SCHEMA_QUERIES.createBrowsedIndex);
    await db.execute(SCHEMA_QUERIES.createSearchesIndex);
    await db.execute(SCHEMA_QUERIES.createOfflineQueueIndex);

    // Run migrations (add new columns to existing tables)
    for (const migration of SCHEMA_QUERIES.migrations) {
      try {
        await db.execute(migration);
      } catch (migrationError: any) {
        // Ignore "duplicate column" errors - column already exists
        if (!migrationError?.message?.includes('duplicate column')) {
          console.warn('Migration warning:', migrationError?.message);
        }
      }
    }

    console.log('TARAI local database initialized successfully');
  } catch (error) {
    console.error('Failed to initialize TARAI database:', error);
    throw error;
  }
};
