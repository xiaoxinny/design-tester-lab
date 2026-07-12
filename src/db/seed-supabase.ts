/**
 * `pnpm db:seed:supabase` -- seed the 8 v1 augmentations into remote Supabase Postgres.
 *
 * Reads the same YAML files as `db:seed` (local) but writes to the Supabase
 * connection string in SUPABASE_DB_URL. Used when running in Supabase Cloud mode.
 *
 * STUB for Day 1: this is a placeholder. The real implementation comes when we
 * build the Supabase schema + adapter. For now, this exits with a clear
 * message telling the user to apply the schema manually.
 */

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error("error: SUPABASE_DB_URL is not set. Run with:");
  console.error("  SUPABASE_DB_URL=postgresql://user:pass@host:5432/db pnpm db:seed:supabase");
  process.exit(1);
}

console.log("STUB: pnpm db:seed:supabase is not implemented yet.");
console.log("");
console.log("For now, to seed your Supabase project:");
console.log("  1. Apply docs/supabase-schema.sql via the Supabase dashboard SQL editor");
console.log("  2. (Day 2+) this script will POST augmentations to your Supabase Postgres");
console.log("");
const host = url.startsWith("postgresql://") ? url.split("@")[1] ?? "(no host)" : "(invalid url)";
console.log("SUPABASE_DB_URL is set, host=" + host);
process.exit(0);
