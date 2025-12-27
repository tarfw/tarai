// Shared database connection for TARAI
import { open, OPSQLiteConnection } from '@op-engineering/op-sqlite';

let db: OPSQLiteConnection | null = null;

export const getDb = (): OPSQLiteConnection => {
  if (!db) {
    db = open({ name: 'tarai.db' });
  }
  return db;
};

export const closeDb = (): void => {
  if (db) {
    db.close();
    db = null;
  }
};
