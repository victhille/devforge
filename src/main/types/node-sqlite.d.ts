// node:sqlite ships with Electron's Node 24; @types/node 20 does not know it yet.
// Only what DevForge uses (Automations's cache, read-only).
declare module 'node:sqlite' {
  export class StatementSync {
    all(...params: unknown[]): unknown[]
    get(...params: unknown[]): unknown
  }
  export class DatabaseSync {
    constructor(path: string, options?: { readOnly?: boolean; open?: boolean })
    exec(sql: string): void
    prepare(sql: string): StatementSync
    close(): void
  }
}
