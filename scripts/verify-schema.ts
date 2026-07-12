import Database from "better-sqlite3";

interface ColumnInfo {
  name: string;
  type: string;
  notnull: number;
  dflt_value: unknown;
}

const db = new Database("./data/design-tester-lab.db");
db.pragma("foreign_keys = ON");

const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type = ? AND name NOT LIKE ? ORDER BY name")
  .all("table", "sqlite_%") as { name: string }[];
console.log(`Tables (${tables.length}):`);
for (const t of tables) console.log("  -", t.name);

const indexes = db
  .prepare("SELECT name FROM sqlite_master WHERE type = ? AND name NOT LIKE ? ORDER BY name")
  .all("index", "sqlite_%") as { name: string }[];
console.log(`Indexes (${indexes.length}):`);
for (const i of indexes) console.log("  -", i.name);

const fkViolations = db.pragma("foreign_key_check") as unknown[];
console.log(`FK check: ${fkViolations.length === 0 ? "PASS" : "FAIL"} (${fkViolations.length} violations)`);

const usersSchema = db.prepare("PRAGMA table_info(users)").all() as ColumnInfo[];
console.log(`users columns (${usersSchema.length}):`);
for (const col of usersSchema) {
  const nullable = col.notnull ? " NOT NULL" : "";
  const def = col.dflt_value != null ? ` DEFAULT ${String(col.dflt_value)}` : "";
  console.log(`  - ${col.name}: ${col.type}${nullable}${def}`);
}

db.close();
