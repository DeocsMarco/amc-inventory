import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { config } from '../config';
import { createSchema } from './schema';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    // Ensure directory exists
    const dbDir = path.dirname(config.dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    db = new Database(config.dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    // Create schema
    createSchema(db);

    console.log(`Database initialized at ${config.dbPath}`);
  }
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
