import {Test, TestingModule} from '@nestjs/testing'
import {FastifyAdapter, NestFastifyApplication} from '@nestjs/platform-fastify'
import {WsAdapter} from '@nestjs/platform-ws'
import request from 'supertest'
import {AppModule} from '../src/app.module'

describe('AppController (e2e)', () => {
  let app: NestFastifyApplication

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule]
    }).compile()

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter()
    )
    app.useWebSocketAdapter(new WsAdapter(app))
    await app.init()
    await app.getHttpAdapter().getInstance().ready()
  })

  afterEach(async () => {
    await app.close()
  })

  it('should return 404 for unknown routes', () => {
    return request(app.getHttpServer())
      .get('/api/v1/unknown')
      .expect(404)
      .expect({error: 'Not found'})
  })
})
