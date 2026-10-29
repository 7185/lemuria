import {HttpStatus} from '@nestjs/common'
import {NodeAdapter, NestNodeApplication} from '@nestjs/platform-node'
import {WsAdapter} from '@nestjs/platform-ws'
import {Test, TestingModule} from '@nestjs/testing'
import request from 'supertest'
import {AppModule} from '../src/app.module.js'

describe('AppController (e2e)', () => {
  let app: NestNodeApplication

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule]
    }).compile()

    app = moduleFixture.createNestApplication<NestNodeApplication>(
      new NodeAdapter()
    )
    app.useWebSocketAdapter(new WsAdapter(app))
    await app.init()
  })

  afterEach(async () => {
    await app.close()
  })

  it('should return 404 for unknown routes', () => {
    return request(app.getHttpServer())
      .get('/api/v1/unknown')
      .expect(HttpStatus.NOT_FOUND)
      .expect({error: 'Not found'})
  })
})
