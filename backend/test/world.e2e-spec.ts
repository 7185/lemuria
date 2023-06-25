import {Test, TestingModule} from '@nestjs/testing'
import {FastifyAdapter, NestFastifyApplication} from '@nestjs/platform-fastify'
import {CacheModule} from '@nestjs/cache-manager'
import * as request from 'supertest'
import {WorldModule} from '../src/world/world.module'

describe('AppController (e2e)', () => {
  let app: NestFastifyApplication

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CacheModule.register({isGlobal: true}), WorldModule]
    }).compile()

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter()
    )
    await app.init()
    await app.getHttpAdapter().getInstance().ready()
  })

  it('/api/v1/world (GET)', () => {
    return request(app.getHttpServer()).get('/api/v1/world').expect(200)
  })
})
