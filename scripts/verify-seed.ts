import Database from 'better-sqlite3';

const db = new Database('./data/design-tester-lab.db');
db.pragma('foreign_keys = ON');

const rows = db.prepare('SELECT id, conflicts_with, requires FROM augmentations').all() as Array<{
  id: string;
  conflicts_with: string | null;
  requires: string | null;
}>;

let ok = true;
for (const r of rows) {
  try {
    const conflicts = r.conflicts_with ? JSON.parse(r.conflicts_with) : [];
    const requires = r.requires ? JSON.parse(r.requires) : [];
    if (!Array.isArray(conflicts) || !Array.isArray(requires)) {
      console.error(`FAIL: ${r.id} -- JSON parsed but not arrays`);
      ok = false;
    } else {
      console.log(`OK:   ${r.id} -- conflicts=${conflicts.length} requires=${requires.length}`);
    }
  } catch (e) {
    console.error(`FAIL: ${r.id} -- JSON parse error: ${e}`);
    ok = false;
  }
}

const emptyPrompts = db
  .prepare("SELECT id FROM augmentations WHERE system_prompt IS NULL OR length(system_prompt) < 50")
  .all() as Array<{ id: string }>;
if (emptyPrompts.length > 0) {
  console.error(`FAIL: empty/short system_prompts: ${emptyPrompts.map((r) => r.id).join(', ')}`);
  ok = false;
} else {
  console.log(`OK:   all 8 system_prompts non-empty and >= 50 chars`);
}

const dups = db
  .prepare('SELECT id, version, count(*) as c FROM augmentations GROUP BY id, version HAVING c > 1')
  .all() as Array<{ id: string; version: string; c: number }>;
if (dups.length > 0) {
  console.error(`FAIL: duplicate (id, version) pairs: ${dups.length}`);
  ok = false;
} else {
  console.log(`OK:   unique index on (id, version) holds`);
}

console.log(ok ? '\nAll assertions passed.' : '\nFAILURES detected.');
db.close();
process.exit(ok ? 0 : 1);
