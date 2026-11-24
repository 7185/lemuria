import {Injectable, OnModuleDestroy} from '@nestjs/common'
import Database from 'better-sqlite3'
import {BetterSQLite3Database, drizzle} from 'drizzle-orm/better-sqlite3'
import * as schema from './schema.js'

export const openDatabase = (
  url = process.env.ADAPTER_URL ?? ':memory:'
): {sqlite: Database.Database; db: BetterSQLite3Database<typeof schema>} => {
  const sqlite = new Database(url.replace(/^file:/, ''))
  const db = drizzle(sqlite, {schema})
  return {sqlite, db}
}

@Injectable()
export class DbService implements OnModuleDestroy {
  readonly db: BetterSQLite3Database<typeof schema>
  private readonly sqlite: Database.Database

  constructor() {
    const {sqlite, db} = openDatabase()
    this.sqlite = sqlite
    this.db = db
  }

  ping() {
    this.sqlite.prepare('SELECT 1').get()
  }

  onModuleDestroy() {
    this.sqlite.close()
  }
}
