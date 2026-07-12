import type { Config } from 'drizzle-kit';

if (!process.env.DATABASE_URL) {
  // Default to local-mode SQLite path. The push script overrides this for Supabase mode.
  process.env.DATABASE_URL = './data/design-tester-lab.db';
}

export default {
  schema: './src/db/schema-sqlite.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  verbose: true,
  strict: true,
} satisfies Config;