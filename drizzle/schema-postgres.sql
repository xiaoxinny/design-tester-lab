-- design-tester-lab: PostgreSQL schema
-- Use this in Supabase SQL Editor or with psql for direct Postgres.
-- Tables are created in dependency order (users first, then referencing tables).

CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY NOT NULL,
  email text NOT NULL,
  password_hash text NOT NULL,
  created_at bigint NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
  last_login_at bigint
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users (email);

CREATE TABLE IF NOT EXISTS sessions (
  id text PRIMARY KEY NOT NULL,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at bigint NOT NULL,
  created_at bigint NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions (expires_at);

CREATE TABLE IF NOT EXISTS augmentations (
  id text NOT NULL,
  version text NOT NULL,
  name text NOT NULL,
  description text,
  category text NOT NULL,
  system_prompt text NOT NULL,
  conflicts_with text,
  requires text,
  source_url text,
  license text,
  published boolean NOT NULL DEFAULT true,
  created_at bigint NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint
);
CREATE UNIQUE INDEX IF NOT EXISTS augmentations_pk ON augmentations (id, version);
CREATE INDEX IF NOT EXISTS augmentations_published_idx ON augmentations (published);

CREATE TABLE IF NOT EXISTS augmentation_presets (
  id text PRIMARY KEY NOT NULL,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  augmentation_stack text NOT NULL,
  created_at bigint NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint
);
CREATE INDEX IF NOT EXISTS augmentation_presets_user_idx ON augmentation_presets (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS augmentation_presets_user_name_unique ON augmentation_presets (user_id, name);

CREATE TABLE IF NOT EXISTS model_credentials (
  id text PRIMARY KEY NOT NULL,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  label text NOT NULL,
  encrypted_key text,
  base_url text,
  key_version integer NOT NULL DEFAULT 1,
  last_used_at bigint,
  created_at bigint NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint
);
CREATE INDEX IF NOT EXISTS model_credentials_user_idx ON model_credentials (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS model_credentials_user_label_unique ON model_credentials (user_id, label);

CREATE TABLE IF NOT EXISTS prompts (
  id text PRIMARY KEY NOT NULL,
  user_id text REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  category text,
  difficulty text,
  expected_tokens integer,
  is_public boolean NOT NULL DEFAULT false,
  is_system boolean NOT NULL DEFAULT false,
  forked_from text REFERENCES prompts(id),
  created_at bigint NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint
);
CREATE INDEX IF NOT EXISTS prompts_user_idx ON prompts (user_id);
CREATE INDEX IF NOT EXISTS prompts_system_idx ON prompts (is_system);
CREATE INDEX IF NOT EXISTS prompts_category_idx ON prompts (category);

CREATE TABLE IF NOT EXISTS runs (
  id text PRIMARY KEY NOT NULL,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  prompt_id text REFERENCES prompts(id) ON DELETE SET NULL,
  prompt_body text NOT NULL,
  model_credential_id text NOT NULL REFERENCES model_credentials(id) ON DELETE RESTRICT,
  model_id text NOT NULL,
  model_params text NOT NULL DEFAULT '{}',
  augmentation_stack text NOT NULL DEFAULT '[]',
  generated_html text,
  generated_tokens_used integer,
  generated_cost_usd text,
  duration_ms integer,
  lint_report text,
  user_rating integer,
  user_notes text,
  is_public boolean NOT NULL DEFAULT false,
  share_slug text,
  created_at bigint NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint
);
CREATE INDEX IF NOT EXISTS runs_user_created_idx ON runs (user_id, created_at);
CREATE INDEX IF NOT EXISTS runs_prompt_idx ON runs (prompt_id);
CREATE UNIQUE INDEX IF NOT EXISTS runs_share_slug_unique ON runs (share_slug);
CREATE INDEX IF NOT EXISTS runs_is_public_idx ON runs (is_public);

CREATE TABLE IF NOT EXISTS run_comparisons (
  id text PRIMARY KEY NOT NULL,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  run_a_id text NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  run_b_id text NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  winner text NOT NULL,
  notes text,
  created_at bigint NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint
);
CREATE INDEX IF NOT EXISTS run_comparisons_user_idx ON run_comparisons (user_id);

CREATE TABLE IF NOT EXISTS audit_log (
  id text PRIMARY KEY NOT NULL,
  user_id text REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text,
  target_id text,
  metadata text,
  created_at bigint NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint
);
CREATE INDEX IF NOT EXISTS audit_log_user_idx ON audit_log (user_id);
CREATE INDEX IF NOT EXISTS audit_log_action_idx ON audit_log (action);
CREATE INDEX IF NOT EXISTS audit_log_created_at_idx ON audit_log (created_at);
