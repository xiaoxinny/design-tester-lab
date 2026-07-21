export interface DbRow {
  [key: string]: unknown
}

export interface DbRunResult {
  changes: number
}

export interface DbClient {
  get<T = DbRow>(sql: string, ...params: unknown[]): Promise<T | undefined>
  all<T = DbRow>(sql: string, ...params: unknown[]): Promise<T[]>
  run(sql: string, ...params: unknown[]): Promise<DbRunResult>
  exec(sql: string): Promise<void>
}
