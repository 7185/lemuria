import {Injectable, OnModuleInit} from '@nestjs/common'
import {NestFastifyApplication} from '@nestjs/platform-fastify'
import {PrismaClient} from '@prisma/client'

@Injectable()
export class DbService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect()
  }

  async enableShutdownHooks(app: NestFastifyApplication) {
    this.$on('beforeExit', async () => {
      await app.close()
    })
  }
}
