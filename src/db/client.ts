import type { DbClient } from './interface'
import { createSqliteClient } from './sqlite-client'
import { createPostgresClient } from './postgres-client'

export type { DbClient, DbRow, DbRunResult } from './interface'

let client: DbClient | null = null

export function getDb(): DbClient {
  if (client) return client
  const onlineMode = process.env.ONLINE_MODE === '1' || process.env.ONLINE_MODE === 'true'
  const hasSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const hasPostgresUrl = Boolean(
    process.env.DATABASE_URL?.startsWith('postgres') ||
    process.env.SUPABASE_DB_URL?.startsWith('postgres')
  )

  if (onlineMode || hasSupabase || hasPostgresUrl) {
    client = createPostgresClient()
  } else {
    client = createSqliteClient()
  }
  return client
}

// Test-only: reset the cached client so the next getDb() re-creates it.
export function closeDb(): void {
  client = null
}
