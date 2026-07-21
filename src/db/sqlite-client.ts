import Database from 'better-sqlite3'
import type { Database as DatabaseType } from 'better-sqlite3'
import { dirname } from 'node:path'
import { mkdirSync } from 'node:fs'
import type { DbClient, DbRunResult } from './interface'

let db: DatabaseType | null = null

function getSqlite(): DatabaseType {
  if (db) return db
  const url = process.env.DATABASE_URL ?? './data/design-tester-lab.db'
  const dir = dirname(url)
  if (dir && dir !== '.') mkdirSync(dir, { recursive: true })
  const sqlite = new Database(url)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  db = sqlite
  return db
}

export function createSqliteClient(): DbClient {
  return {
    async get<T>(sql: string, ...params: unknown[]): Promise<T | undefined> {
      return getSqlite().prepare(sql).get(...params) as T | undefined
    },
    async all<T>(sql: string, ...params: unknown[]): Promise<T[]> {
      return getSqlite().prepare(sql).all(...params) as T[]
    },
    async run(sql: string, ...params: unknown[]): Promise<DbRunResult> {
      const result = getSqlite().prepare(sql).run(...params)
      return { changes: result.changes }
    },
    async exec(sql: string): Promise<void> {
      getSqlite().exec(sql)
    },
  }
}
