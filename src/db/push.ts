/**
 * `pnpm db:push` — applies all SQL migration files in drizzle/ to the SQLite
 * database file. Idempotent: tracks applied migrations in a __migrations
 * table and skips any that are already recorded.
 *
 * For Supabase Cloud mode, apply `docs/supabase-schema.sql` via the Supabase
 * dashboard SQL editor instead. SQLite is local-mode only.
 */
import Database from 'better-sqlite3';
import { readFileSync, readdirSync, mkdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';

const url = process.env.DATABASE_URL ?? './data/design-tester-lab.db';
const dir = dirname(url);
if (dir && dir !== '.') mkdirSync(dir, { recursive: true });

const sqlite = new Database(url);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

// Ensure the migrations tracking table exists.
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS __migrations (
    name TEXT PRIMARY KEY,
    applied_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  );
`);

const drizzleDir = resolve('./drizzle');
const sqlFiles = readdirSync(drizzleDir)
  .filter((f) => f.endsWith('.sql'))
  .sort();

if (sqlFiles.length === 0) {
  console.error('No .sql migration files found in drizzle/.');
  sqlite.close();
  process.exit(1);
}

const isApplied = sqlite.prepare('SELECT 1 FROM __migrations WHERE name = ?');
const recordApplied = sqlite.prepare('INSERT INTO __migrations (name) VALUES (?)');

let appliedCount = 0;
let skippedCount = 0;
console.log(`pushing ${sqlFiles.length} migration(s) to ${url}`);

for (const file of sqlFiles) {
  if (isApplied.get(file)) {
    console.log(`  ${file}: already applied, skipping`);
    skippedCount++;
    continue;
  }
  const sql = readFileSync(join(drizzleDir, file), 'utf-8');
  const statements = sql
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter(Boolean);
  console.log(`  ${file}: ${statements.length} statement(s)`);
  const apply = sqlite.transaction(() => {
    for (const stmt of statements) sqlite.exec(stmt);
    recordApplied.run(file);
  });
  apply();
  appliedCount++;
}

console.log(`done. applied=${appliedCount} skipped=${skippedCount}`);
sqlite.close();