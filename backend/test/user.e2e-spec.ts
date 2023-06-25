import {Test, TestingModule} from '@nestjs/testing'
import {FastifyAdapter, NestFastifyApplication} from '@nestjs/platform-fastify'
import {fastifyCookie} from '@fastify/cookie'
import * as request from 'supertest'
import {UserModule} from '../src/user/user.module'
import {config} from '../src/app.config'

describe('AppController (e2e)', () => {
  let app: NestFastifyApplication

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [UserModule]
    }).compile()

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter()
    )
    app.register(fastifyCookie, {
      secret: config.secret
    })
    await app.init()
    await app.getHttpAdapter().getInstance().ready()
  })

  it('/api/v1/auth (GET)', () => {
    return request(app.getHttpServer()).get('/api/v1/auth').expect(401)
  })

  it('/api/v1/auth (POST)', () => {
    return request(app.getHttpServer())
      .post('/api/v1/auth')
      .send({
        login: 'alice',
        password: 'P@$$w0rd!'
      })
      .expect(200)
  })
})
