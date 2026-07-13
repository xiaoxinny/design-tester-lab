/**
 * Shared SQLite database client.
 *
 * Singleton wrapper around better-sqlite3. The connection opens lazily on
 * first call to `getDb()` and closes when the process exits.
 *
 * Local-mode only. In Supabase Cloud mode the app uses the Supabase JS
 * client; nothing in src/lib should import from this module in Supabase mode.
 */
import Database from 'better-sqlite3';
import type { Database as DatabaseType } from 'better-sqlite3';
import { dirname } from 'node:path';
import { mkdirSync } from 'node:fs';

let db: DatabaseType | null = null;

export function getDb(): DatabaseType {
  if (db !== null) return db;
  const url = process.env.DATABASE_URL ?? './data/design-tester-lab.db';
  const dir = dirname(url);
  if (dir && dir !== '.') mkdirSync(dir, { recursive: true });
  const sqlite = new Database(url);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  db = sqlite;
  return db;
}

/**
 * Test-only: close the connection so the next `getDb()` re-opens. Used by
 * the test scripts to clean up after a run.
 */
export function closeDb(): void {
  if (db !== null) {
    db.close();
    db = null;
  }
}
