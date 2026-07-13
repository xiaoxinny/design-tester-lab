/**
 * Drizzle schema — SQLite (local mode + test/dev).
 *
 * IMPORTANT: This is the SQLite dialect. There is a separate Postgres-flavored
 * schema at `schema-supabase.ts` for Supabase Cloud mode. The two schemas are
 * intentionally separate because:
 *
 *   - SQLite has no native UUID, JSONB, or array types (we use TEXT)
 *   - SQLite has no RLS (we enforce row ownership in application code)
 *   - Some Postgres features (e.g., jsonb_path_ops GIN indexes) are not portable
 *
 * If you change this file, regenerate migrations with `pnpm db:generate`
 * (drizzle-kit reads drizzle.config.ts which points here).
 *
 * For the corresponding Supabase schema + RLS policies, see
 * `src/db/schema-supabase.ts` and `docs/supabase-schema.sql` (deployed via the
 * Supabase dashboard SQL editor).
 */

import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
  type AnySQLiteColumn,
} from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// =====================================================================
// Users (local mode only — Supabase mode uses auth.users instead)
// =====================================================================

export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(), // uuid-as-string; generated in app code
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(), // argon2id (OWASP-min-A defaults)
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    lastLoginAt: integer('last_login_at', { mode: 'timestamp_ms' }),
  },
  (t) => ({
    emailIdx: uniqueIndex('users_email_idx').on(t.email),
  }),
);

// =====================================================================
// Sessions (local mode only — Supabase mode uses Supabase Auth cookies)
// =====================================================================

export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(), // random 32-byte hex; the session cookie value
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    userIdx: index('sessions_user_idx').on(t.userId),
    expiresIdx: index('sessions_expires_idx').on(t.expiresAt),
  }),
);

// =====================================================================
// Model credentials (BYOK — encrypted at rest with AES-256-GCM)
// =====================================================================

export const modelCredentials = sqliteTable(
  'model_credentials',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider', {
      enum: ['anthropic', 'openai', 'google', 'openrouter', 'ollama', 'custom'],
    }).notNull(),
    label: text('label').notNull(), // user-given nickname ("work-anthropic", etc.)
    encryptedKey: text('encrypted_key'), // AES-256-GCM; format: <iv_b64>:<ct_b64>:<tag_b64>
    baseUrl: text('base_url'), // required for ollama/custom; null otherwise
    keyVersion: integer('key_version').notNull().default(1), // for ENCRYPTION_KEY rotation
    lastUsedAt: integer('last_used_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    userIdx: index('model_credentials_user_idx').on(t.userId),
    userLabelUnique: uniqueIndex('model_credentials_user_label_unique').on(t.userId, t.label),
  }),
);

// =====================================================================
// Augmentations (curated by us, versioned, public-readable in the schema)
// =====================================================================

export const augmentations = sqliteTable(
  'augmentations',
  {
    id: text('id').notNull(), // e.g. 'shadcn-tokens'
    version: text('version').notNull(), // semver, e.g. '1.0.0'
    name: text('name').notNull(),
    description: text('description'),
    category: text('category', {
      enum: ['tokens', 'principles', 'behavior'],
    }).notNull(),
    systemPrompt: text('system_prompt').notNull(),
    conflictsWith: text('conflicts_with'), // JSON-encoded string[] of augmentation ids
    requires: text('requires'), // JSON-encoded string[] of augmentation ids
    sourceUrl: text('source_url'),
    license: text('license'),
    published: integer('published', { mode: 'boolean' }).notNull().default(true),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    pk: uniqueIndex('augmentations_pk').on(t.id, t.version),
    publishedIdx: index('augmentations_published_idx').on(t.published),
  }),
);

// =====================================================================
// Augmentation presets (user-saved stacks)
// =====================================================================

export const augmentationPresets = sqliteTable(
  'augmentation_presets',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    augmentationStack: text('augmentation_stack').notNull(), // JSON-encoded [{id, version}, ...]
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    userIdx: index('augmentation_presets_user_idx').on(t.userId),
    userNameUnique: uniqueIndex('augmentation_presets_user_name_unique').on(t.userId, t.name),
  }),
);

// =====================================================================
// Prompts (user's library + curated starter prompts)
// =====================================================================

export const prompts = sqliteTable(
  'prompts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }), // nullable for system prompts
    title: text('title').notNull(),
    body: text('body').notNull(),
    category: text('category', {
      enum: ['system-tools', 'dashboard', 'mobile', 'form', 'pricing', 'landing', 'onboarding', 'custom'],
    }),
    difficulty: text('difficulty', { enum: ['easy', 'medium', 'hard'] }),
    expectedTokens: integer('expected_tokens'),
    isPublic: integer('is_public', { mode: 'boolean' }).notNull().default(false),
    isSystem: integer('is_system', { mode: 'boolean' }).notNull().default(false), // curated starter prompts
    forkedFrom: text('forked_from').references((): AnySQLiteColumn => prompts.id),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    userIdx: index('prompts_user_idx').on(t.userId),
    systemIdx: index('prompts_system_idx').on(t.isSystem),
    categoryIdx: index('prompts_category_idx').on(t.category),
  }),
);

// =====================================================================
// Runs (every generation is a row)
// =====================================================================

export const runs = sqliteTable(
  'runs',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    promptId: text('prompt_id').references(() => prompts.id, { onDelete: 'set null' }), // nullable if ad-hoc
    promptBody: text('prompt_body').notNull(), // denormalized; survives prompt edits/deletes
    modelCredentialId: text('model_credential_id')
      .notNull()
      .references(() => modelCredentials.id, { onDelete: 'restrict' }), // restrict because we need the key to re-render
    modelId: text('model_id').notNull(), // 'claude-sonnet-4-5-20250929' etc.
    modelParams: text('model_params').notNull().default('{}'), // JSON-encoded {temperature, top_p, max_tokens}
    augmentationStack: text('augmentation_stack').notNull().default('[]'), // JSON-encoded [{id, version}, ...]
    generatedHtml: text('generated_html'),
    generatedTokensUsed: integer('generated_tokens_used'),
    generatedCostUsd: text('generated_cost_usd'), // numeric-as-text to avoid float precision issues
    durationMs: integer('duration_ms'),
    lintReport: text('lint_report'), // JSON-encoded {axe, contrast, tokens, spacing, semantic_html}
    userRating: integer('user_rating'), // 1-5
    userNotes: text('user_notes'),
    isPublic: integer('is_public', { mode: 'boolean' }).notNull().default(false),
    shareSlug: text('share_slug'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    userCreatedIdx: index('runs_user_created_idx').on(t.userId, t.createdAt),
    promptIdx: index('runs_prompt_idx').on(t.promptId),
    shareSlugUnique: uniqueIndex('runs_share_slug_unique').on(t.shareSlug),
    isPublicIdx: index('runs_is_public_idx').on(t.isPublic),
  }),
);

// =====================================================================
// Run comparisons (A/B voting)
// =====================================================================

export const runComparisons = sqliteTable(
  'run_comparisons',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    runAId: text('run_a_id')
      .notNull()
      .references(() => runs.id, { onDelete: 'cascade' }),
    runBId: text('run_b_id')
      .notNull()
      .references(() => runs.id, { onDelete: 'cascade' }),
    winner: text('winner', { enum: ['a', 'b', 'tie'] }).notNull(),
    notes: text('notes'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    userIdx: index('run_comparisons_user_idx').on(t.userId),
    // Note: we don't enforce runAId <> runBId at the DB level because SQLite
    // CHECK constraints can't reference column values across rows. The app
    // validates this on insert.
  }),
);

// =====================================================================
// Type exports (for use in app code)
// =====================================================================

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type ModelCredential = typeof modelCredentials.$inferSelect;
export type NewModelCredential = typeof modelCredentials.$inferInsert;
export type Augmentation = typeof augmentations.$inferSelect;
export type NewAugmentation = typeof augmentations.$inferInsert;
export type AugmentationPreset = typeof augmentationPresets.$inferSelect;
export type NewAugmentationPreset = typeof augmentationPresets.$inferInsert;
export type Prompt = typeof prompts.$inferSelect;
export type NewPrompt = typeof prompts.$inferInsert;
export type Run = typeof runs.$inferSelect;
export type NewRun = typeof runs.$inferInsert;
export type RunComparison = typeof runComparisons.$inferSelect;
export type NewRunComparison = typeof runComparisons.$inferInsert;