/**
 * `pnpm db:seed` (local mode) — reads augmentation YAML files from
 * `content/augmentations/` and upserts them into the SQLite `augmentations` table.
 *
 * Idempotent: re-running replaces existing rows with the same (id, version) primary key.
 *
 * For Supabase Cloud mode, run `pnpm db:seed:supabase` instead. Both scripts
 * load the same YAML files; they only differ in the database connection.
 */
import Database from 'better-sqlite3';
import { readFileSync, readdirSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import yaml from 'js-yaml';

// SECURITY: Use yaml.loadAll with the FAILSAFE_SCHEMA equivalent —
// js-yaml's `safeLoad` blocks arbitrary-object tags. Our augmentation
// YAMLs are author-controlled and live in our repo, but we use the
// safe path anyway because it's strictly cheaper than auditing each file.
const safeLoad = (s: string): unknown =>
  yaml.load(s, { schema: yaml.JSON_SCHEMA });

const dbUrl = process.env.DATABASE_URL ?? './data/design-tester-lab.db';
const dir = dirname(dbUrl);
if (dir && dir !== '.') mkdirSync(dir, { recursive: true });

const sqlite = new Database(dbUrl);
sqlite.pragma('foreign_keys = ON');

interface AugmentationFrontmatter {
  id: string;
  version: string;
  name: string;
  description?: string;
  category: 'tokens' | 'principles' | 'behavior';
  license?: string;
  source?: string;
  conflicts_with?: string[];
  requires?: string[];
}

interface AugmentationDoc extends AugmentationFrontmatter {
  systemPrompt: string;
}

function parseAugmentationFile(path: string): AugmentationDoc {
  const raw = readFileSync(path, 'utf-8');
  // Split on the first '---' line that ends the frontmatter block.
  // We use a simple regex: frontmatter is between the first and second '---' lines.
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    throw new Error(`no frontmatter found in ${path}`);
  }
  const fmRaw = match[1];
  const body = match[2];
  if (fmRaw === undefined || body === undefined) {
    throw new Error(`malformed frontmatter in ${path}`);
  }
  const fm = safeLoad(fmRaw) as AugmentationFrontmatter;
  if (!fm.id || !fm.version || !fm.name || !fm.category) {
    throw new Error(`missing required frontmatter fields in ${path}`);
  }
  return { ...fm, systemPrompt: body.trim() };
}

const augmentationsDir = resolve('./content/augmentations');
const files = readdirSync(augmentationsDir).filter((f) => f.endsWith('.md') || f.endsWith('.yaml') || f.endsWith('.yml'));

console.log(`loading ${files.length} augmentation(s) from ${augmentationsDir}`);

const upsert = sqlite.prepare(`
  INSERT INTO augmentations (
    id, version, name, description, category, system_prompt,
    conflicts_with, requires, source_url, license, published, created_at
  ) VALUES (
    @id, @version, @name, @description, @category, @system_prompt,
    @conflicts_with, @requires, @source_url, @license, 1,
    COALESCE((SELECT created_at FROM augmentations WHERE id = @id AND version = @version), unixepoch() * 1000)
  )
  ON CONFLICT (id, version) DO UPDATE SET
    name = excluded.name,
    description = excluded.description,
    category = excluded.category,
    system_prompt = excluded.system_prompt,
    conflicts_with = excluded.conflicts_with,
    requires = excluded.requires,
    source_url = excluded.source_url,
    license = excluded.license,
    published = excluded.published
`);

const tx = sqlite.transaction((docs: AugmentationDoc[]) => {
  for (const doc of docs) {
    upsert.run({
      id: doc.id,
      version: doc.version,
      name: doc.name,
      description: doc.description ?? null,
      category: doc.category,
      system_prompt: doc.systemPrompt,
      conflicts_with: JSON.stringify(doc.conflicts_with ?? []),
      requires: JSON.stringify(doc.requires ?? []),
      source_url: doc.source ?? null,
      license: doc.license ?? null,
    });
    console.log(`  → ${doc.id}@${doc.version} (${doc.category})`);
  }
});

const docs = files.map((f) => parseAugmentationFile(resolve(augmentationsDir, f)));
tx(docs);

console.log(`\nseeded ${docs.length} augmentation(s).`);

const rows = sqlite.prepare('SELECT id, version, category, name FROM augmentations ORDER BY category, id').all() as Array<{
  id: string;
  version: string;
  category: string;
  name: string;
}>;
console.log('\ncurrent augmentations in DB:');
for (const r of rows) console.log(`  [${r.category.padEnd(10)}] ${r.id}@${r.version} — ${r.name}`);

sqlite.close();