import {CacheModule} from '@nestjs/cache-manager'
import {HttpStatus} from '@nestjs/common'
import {NodeAdapter, NestNodeApplication} from '@nestjs/platform-node'
import {Test, TestingModule} from '@nestjs/testing'
import request from 'supertest'
import {WorldModule} from '../src/world/world.module.js'

describe('AppController (e2e)', () => {
  let app: NestNodeApplication

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CacheModule.register({isGlobal: true}), WorldModule]
    }).compile()

    app = moduleFixture.createNestApplication<NestNodeApplication>(
      new NodeAdapter()
    )
    await app.init()
  })

  it('/api/v1/world (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/v1/world')
      .expect(HttpStatus.OK)
  })
})
