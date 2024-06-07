import {Test, TestingModule} from '@nestjs/testing'
import type {FastifyReply} from 'fastify'
import {AppController} from './app.controller'
import {AppService} from './app.service'

describe(AppController.name, () => {
  let appController: AppController

  beforeAll(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService]
    }).compile()

    appController = app.get<AppController>(AppController)
  })

  describe('unknown api route', () => {
    it('should return a 404 status code', () => {
      const statusResponseMock = {
        send: jest.fn((x) => x)
      }
      const responseMock = {
        status: jest.fn().mockReturnValue(statusResponseMock),
        send: jest.fn((x) => x)
      } as unknown as FastifyReply
      appController.notImplemented(responseMock)
      expect(responseMock.status).toHaveBeenCalledWith(404)
      expect(statusResponseMock.send).toHaveBeenCalledWith({error: 'Not found'})
    })
  })
})
