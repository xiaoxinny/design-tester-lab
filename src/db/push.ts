/**
 * `pnpm db:push` — creates the SQLite database file with the schema.
 *
 * For Supabase Cloud mode, apply `docs/supabase-schema.sql` via the Supabase
 * dashboard SQL editor instead. SQLite is local-mode only.
 *
 * Implementation note: we run the generated SQL directly rather than using
 * drizzle-orm/better-sqlite3/migrator, because the latter requires a runtime
 * that reads the journal in JS — overkill for one migration file.
 */
import Database from 'better-sqlite3';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const url = process.env.DATABASE_URL ?? './data/design-tester-lab.db';
const dir = dirname(url);
if (dir && dir !== '.') mkdirSync(dir, { recursive: true });

const sqlite = new Database(url);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

const sqlPath = resolve('./drizzle/0000_smooth_blue_blade.sql');
const sql = readFileSync(sqlPath, 'utf-8');

// SQLite doesn't support multiple statements per exec() by default; split on
// the drizzle-kit statement-breakpoint marker.
const statements = sql
  .split('--> statement-breakpoint')
  .map((s) => s.trim())
  .filter(Boolean);

console.log(`pushing ${statements.length} statement(s) to ${url}`);
const insert = sqlite.transaction(() => {
  for (const stmt of statements) sqlite.exec(stmt);
});
insert();

console.log('done.');
sqlite.close();