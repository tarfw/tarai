const COMMERCE_INDEXES = [
  "CREATE INDEX IF NOT EXISTS paymentday ON records(json_extract(data,'$.businessDate')) WHERE type='pos.payment'",
  "CREATE INDEX IF NOT EXISTS orderday ON records(json_extract(data,'$.businessDate')) WHERE type='pos.order'",
  "CREATE INDEX IF NOT EXISTS paymentregister ON records(json_extract(data,'$.registerId')) WHERE type='pos.payment'",
  "CREATE INDEX IF NOT EXISTS customerorders ON records(json_extract(data,'$.customerId')) WHERE type='pos.order'",
  "CREATE UNIQUE INDEX IF NOT EXISTS paymentreference ON records(json_extract(data,'$.reference')) WHERE type='pos.payment' AND json_extract(data,'$.reference') IS NOT NULL",
  "CREATE UNIQUE INDEX IF NOT EXISTS productbarcode ON records(json_extract(data,'$.barcode')) WHERE type='pos.product' AND json_extract(data,'$.barcode')!='' AND archived IS NULL",
  "CREATE UNIQUE INDEX IF NOT EXISTS productsku ON records(json_extract(data,'$.sku')) WHERE type='pos.product' AND json_extract(data,'$.sku')!='' AND archived IS NULL",
  "CREATE UNIQUE INDEX IF NOT EXISTS openregister ON records(type) WHERE type='pos.register' AND state='open'",
  "CREATE UNIQUE INDEX IF NOT EXISTS orderdraft ON records(owner,json_extract(data,'$.draftKey')) WHERE type='pos.order' AND json_extract(data,'$.draftKey') IS NOT NULL",
];

/** Complete, idempotent schema for a fresh TAR workspace. */
export const WORKSPACE_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS records (
    id TEXT PRIMARY KEY, type TEXT NOT NULL, title TEXT NOT NULL, state TEXT NOT NULL,
    data TEXT NOT NULL CHECK(json_valid(data)), owner TEXT, assignee TEXT, due INTEGER,
    version INTEGER NOT NULL, created INTEGER NOT NULL, updated INTEGER NOT NULL, archived INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS move (
    id TEXT PRIMARY KEY, kind TEXT NOT NULL, run_id TEXT, record_id TEXT, action_id TEXT,
    state TEXT NOT NULL, actor_id TEXT, input_hash TEXT NOT NULL, idempotency_key TEXT NOT NULL,
    amount INTEGER, why TEXT, source TEXT,
    data TEXT NOT NULL CHECK(json_valid(data)), created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
    UNIQUE(idempotency_key)
  )`,
  // The event feed is a view over move: every change ever, append-only.
  'DROP VIEW IF EXISTS events',
  'CREATE VIEW events AS SELECT * FROM move',
  `CREATE TABLE IF NOT EXISTS current (
    kind TEXT NOT NULL, key TEXT NOT NULL, data TEXT NOT NULL CHECK(json_valid(data)),
    PRIMARY KEY (kind, key)
  )`,
  `CREATE TABLE IF NOT EXISTS skill (
    id TEXT PRIMARY KEY, shape TEXT NOT NULL, trigger TEXT NOT NULL,
    data TEXT NOT NULL CHECK(json_valid(data)), score REAL NOT NULL DEFAULT 0,
    confirmed INTEGER, created INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS run (
    id TEXT PRIMARY KEY, skill TEXT NOT NULL, step INTEGER NOT NULL,
    status TEXT NOT NULL, key TEXT NOT NULL UNIQUE, input TEXT NOT NULL CHECK(json_valid(input)),
    created INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS inbox (
    id TEXT PRIMARY KEY, member TEXT NOT NULL, move TEXT, tool TEXT NOT NULL,
    reach TEXT NOT NULL, due INTEGER, assigned TEXT, status TEXT NOT NULL,
    data TEXT NOT NULL CHECK(json_valid(data)), created INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS links (
    id TEXT PRIMARY KEY, source TEXT NOT NULL, target TEXT NOT NULL, role TEXT NOT NULL,
    since INTEGER, until INTEGER, data TEXT NOT NULL CHECK(json_valid(data)), actor TEXT NOT NULL,
    created INTEGER NOT NULL, updated INTEGER NOT NULL,
    FOREIGN KEY(source) REFERENCES records(id), FOREIGN KEY(target) REFERENCES records(id)
  )`,
  `CREATE TABLE IF NOT EXISTS consents (
    id TEXT PRIMARY KEY, contact TEXT NOT NULL, channel TEXT NOT NULL, purpose TEXT NOT NULL,
    state TEXT NOT NULL, source TEXT NOT NULL, actor TEXT NOT NULL, created INTEGER NOT NULL,
    FOREIGN KEY(contact) REFERENCES records(id)
  )`,
  'CREATE INDEX IF NOT EXISTS source ON links(source, until)',
  'CREATE INDEX IF NOT EXISTS target ON links(target, until)',
  'CREATE UNIQUE INDEX IF NOT EXISTS active ON links(source, target, role) WHERE until IS NULL',
  'CREATE INDEX IF NOT EXISTS recordtype ON records(type, state, updated DESC) WHERE archived IS NULL',
  'CREATE INDEX IF NOT EXISTS contacts ON records(type, title COLLATE NOCASE, id) WHERE archived IS NULL',
  'CREATE INDEX IF NOT EXISTS movekind ON move(kind, created_at DESC)',
  'CREATE INDEX IF NOT EXISTS moverecord ON move(record_id, created_at DESC)',
  'CREATE INDEX IF NOT EXISTS inboxmember ON inbox(member, status, due)',
  'CREATE INDEX IF NOT EXISTS skillshape ON skill(shape)',
  'CREATE INDEX IF NOT EXISTS consent ON consents(contact, created DESC)',
  "CREATE INDEX IF NOT EXISTS taskowner ON records(assignee, state, updated DESC) WHERE type='task' AND archived IS NULL",
  ...COMMERCE_INDEXES,
] as const;
