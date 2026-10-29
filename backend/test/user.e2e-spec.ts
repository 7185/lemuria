import {HttpStatus} from '@nestjs/common'
import {NodeAdapter, NestNodeApplication} from '@nestjs/platform-node'
import {Test, TestingModule} from '@nestjs/testing'
import request from 'supertest'
import {UserModule} from '../src/user/user.module.js'

describe('AppController (e2e)', () => {
  let app: NestNodeApplication

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [UserModule]
    }).compile()

    app = moduleFixture.createNestApplication<NestNodeApplication>(
      new NodeAdapter()
    )
    await app.init()
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
      .expect(HttpStatus.OK)
  })
})
