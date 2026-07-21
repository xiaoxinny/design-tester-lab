import postgres from 'postgres'
import type { DbClient, DbRunResult } from './interface'

let sql: ReturnType<typeof postgres> | null = null

function getPg() {
  if (sql) return sql
  const url = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL
  if (!url) throw new Error('DATABASE_URL or SUPABASE_DB_URL required for Postgres mode')
  sql = postgres(url, { max: 10 })
  return sql
}

function toPgParams(query: string): string {
  let idx = 0
  return query.replace(/\?/g, () => `$${++idx}`)
}

export function createPostgresClient(): DbClient {
  return {
    async get<T>(query: string, ...params: unknown[]): Promise<T | undefined> {
      const pg = getPg()
      const pgQuery = toPgParams(query)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = await pg.unsafe(pgQuery, params as any)
      return rows[0] as T | undefined
    },
    async all<T>(query: string, ...params: unknown[]): Promise<T[]> {
      const pg = getPg()
      const pgQuery = toPgParams(query)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = (await pg.unsafe(pgQuery, params as any)) as unknown as T[]
      return rows
    },
    async run(query: string, ...params: unknown[]): Promise<DbRunResult> {
      const pg = getPg()
      const pgQuery = toPgParams(query)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await pg.unsafe(pgQuery, params as any)
      return { changes: result.count ?? 0 }
    },
    async exec(query: string): Promise<void> {
      const pg = getPg()
      await pg.unsafe(query)
    },
  }
}
