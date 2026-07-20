#!/bin/sh
set -e

# Detect mode — skip SQLite operations in online mode
if [ "$ONLINE_MODE" = '1' ] || [ "$ONLINE_MODE" = 'true' ] || [ -n "$NEXT_PUBLIC_SUPABASE_URL" ]; then
  echo '==> Online mode detected, skipping SQLite initialization (database is external)'
  echo "==> Starting server on port ${PORT:-3030}..."
  exec node server.js
fi

echo "==> Running database migrations..."
node -e "
const Database = require('better-sqlite3');
const { readFileSync, readdirSync, mkdirSync } = require('fs');
const { dirname, resolve, join } = require('path');

const url = process.env.DATABASE_URL || './data/design-tester-lab.db';
const dir = dirname(url);
if (dir && dir !== '.') mkdirSync(dir, { recursive: true });

const sqlite = new Database(url);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

sqlite.exec(\`
  CREATE TABLE IF NOT EXISTS __migrations (
    name TEXT PRIMARY KEY,
    applied_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  );
\`);

const drizzleDir = resolve('./drizzle');
const sqlFiles = readdirSync(drizzleDir).filter(f => f.endsWith('.sql')).sort();
const isApplied = sqlite.prepare('SELECT 1 FROM __migrations WHERE name = ?');
const recordApplied = sqlite.prepare('INSERT INTO __migrations (name) VALUES (?)');

let applied = 0;
for (const file of sqlFiles) {
  if (isApplied.get(file)) continue;
  const sql = readFileSync(join(drizzleDir, file), 'utf-8');
  const stmts = sql.split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean);
  const tx = sqlite.transaction(() => {
    for (const stmt of stmts) sqlite.exec(stmt);
    recordApplied.run(file);
  });
  tx();
  applied++;
  console.log('  applied:', file);
}
if (applied === 0) console.log('  all migrations already applied');
else console.log('  applied', applied, 'migration(s)');
sqlite.close();
"

echo "==> Seeding augmentations..."
node -e "
const Database = require('better-sqlite3');
const { readFileSync, readdirSync } = require('fs');
const { resolve, join } = require('path');
const yaml = require('js-yaml');

const url = process.env.DATABASE_URL || './data/design-tester-lab.db';
const sqlite = new Database(url);
sqlite.pragma('foreign_keys = ON');

const augDir = process.env.AUGMENTATIONS_DIR || './content/augmentations';
const files = readdirSync(resolve(augDir)).filter(f => f.endsWith('.md'));

const upsert = sqlite.prepare(
  'INSERT OR REPLACE INTO augmentations (id, version, name, description, category, system_prompt, conflicts_with, requires, source_url, license, published) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)'
);

let count = 0;
for (const file of files) {
  const raw = readFileSync(join(resolve(augDir), file), 'utf8').replace(/\\r\\n/g, '\\n');
  const match = raw.match(/^---\\n([\\s\\S]*?)\\n---\\n([\\s\\S]*)$/);
  if (!match) { console.warn('  skipped (no frontmatter):', file); continue; }
  let meta;
  try { meta = yaml.load(match[1]); } catch (e) { console.warn('  skipped (invalid YAML):', file, e.message); continue; }
  const body = match[2].trim();
  upsert.run(
    meta.id, meta.version || '1.0.0', meta.name, meta.description || null,
    meta.category, body,
    JSON.stringify(meta.conflicts_with || []),
    JSON.stringify(meta.requires || []),
    meta.source || null, meta.license || null
  );
  count++;
}
console.log('  seeded', count, 'augmentation(s)');
sqlite.close();
"

echo "==> Starting server on port ${PORT:-3030}..."
exec node server.js
