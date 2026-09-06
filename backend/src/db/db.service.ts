import {Injectable, OnModuleInit} from '@nestjs/common'
import {PrismaBetterSqlite3} from '@prisma/adapter-better-sqlite3'
import {PrismaClient} from '../generated/prisma/client.js'

@Injectable()
export class DbService extends PrismaClient implements OnModuleInit {
  constructor() {
    super({
      adapter: new PrismaBetterSqlite3({
        url: process.env.ADAPTER_URL ?? ':memory:'
      })
    })
  }
  async onModuleInit() {
    await this.$connect()
  }
}
