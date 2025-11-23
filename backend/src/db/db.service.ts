import {Injectable, OnModuleInit} from '@nestjs/common'
import {PrismaClient} from '../generated/prisma/client'
import {PrismaBetterSqlite3} from '@prisma/adapter-better-sqlite3'

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
