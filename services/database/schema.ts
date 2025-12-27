// TARAI Local Database Schema (OP-SQLite)
// 3-table schema: nodes, people, tasks

export const SCHEMA_QUERIES = {
  // Main nodes table (10 columns)
  createNodesTable: `
    CREATE TABLE IF NOT EXISTS nodes (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      parent TEXT,
      data TEXT,
      quantity INTEGER DEFAULT 1,
      value REAL DEFAULT 0,
      location TEXT,
      status TEXT DEFAULT 'active',
      created INTEGER NOT NULL,
      updated INTEGER NOT NULL
    );
  `,

  createNodesIndexes: [
    `CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type);`,
    `CREATE INDEX IF NOT EXISTS idx_nodes_parent ON nodes(parent);`,
    `CREATE INDEX IF NOT EXISTS idx_nodes_type_parent ON nodes(type, parent);`,
    `CREATE INDEX IF NOT EXISTS idx_nodes_status ON nodes(status);`,
    `CREATE INDEX IF NOT EXISTS idx_nodes_updated ON nodes(updated);`,
  ],

  // People junction table (node <-> person relationships)
  createPeopleTable: `
    CREATE TABLE IF NOT EXISTS people (
      nodeid TEXT NOT NULL,
      personid TEXT NOT NULL,
      role TEXT,
      PRIMARY KEY (nodeid, personid),
      FOREIGN KEY (nodeid) REFERENCES nodes(id) ON DELETE CASCADE
    );
  `,

  createPeopleIndexes: [
    `CREATE INDEX IF NOT EXISTS idx_people_personid ON people(personid);`,
    `CREATE INDEX IF NOT EXISTS idx_people_role ON people(personid, role);`,
  ],

  // Tasks table (11 columns)
  createTasksTable: `
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      nodeid TEXT NOT NULL,
      personid TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      priority INTEGER DEFAULT 0,
      due INTEGER,
      data TEXT,
      created INTEGER NOT NULL,
      updated INTEGER NOT NULL,
      FOREIGN KEY (nodeid) REFERENCES nodes(id) ON DELETE CASCADE
    );
  `,

  createTasksIndexes: [
    `CREATE INDEX IF NOT EXISTS idx_tasks_personid ON tasks(personid);`,
    `CREATE INDEX IF NOT EXISTS idx_tasks_nodeid ON tasks(nodeid);`,
    `CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);`,
    `CREATE INDEX IF NOT EXISTS idx_tasks_personid_status ON tasks(personid, status);`,
    `CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due);`,
  ],
};

export const initializeDatabase = async (db: any) => {
  try {
    console.log('Initializing TARAI database (3-table schema)...');

    // Drop old legacy tables (not vector tables - those persist embeddings)
    const oldTables = [
      'mycache', 'browsed', 'searches', 'offlinequeue', 'cart',
      'tarai_listing_vectors', 'tarai_listing_vectors_metadata'
    ];

    for (const table of oldTables) {
      try {
        await db.execute(`DROP TABLE IF EXISTS ${table};`);
      } catch (e) {
        // Ignore errors
      }
    }
    console.log('Cleaned up legacy tables');

    // Create nodes table and indexes
    await db.execute(SCHEMA_QUERIES.createNodesTable);
    for (const indexQuery of SCHEMA_QUERIES.createNodesIndexes) {
      await db.execute(indexQuery);
    }
    console.log('Created nodes table');

    // Create people table and indexes
    await db.execute(SCHEMA_QUERIES.createPeopleTable);
    for (const indexQuery of SCHEMA_QUERIES.createPeopleIndexes) {
      await db.execute(indexQuery);
    }
    console.log('Created people table');

    // Create tasks table and indexes
    await db.execute(SCHEMA_QUERIES.createTasksTable);
    for (const indexQuery of SCHEMA_QUERIES.createTasksIndexes) {
      await db.execute(indexQuery);
    }
    console.log('Created tasks table');

    console.log('TARAI database initialized successfully (3 tables)');
  } catch (error) {
    console.error('Failed to initialize TARAI database:', error);
    throw error;
  }
};
