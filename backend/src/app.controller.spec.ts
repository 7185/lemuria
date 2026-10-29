import {HttpStatus, NotFoundException} from '@nestjs/common'
import {Test, TestingModule} from '@nestjs/testing'
import {AppController} from './app.controller.js'
import {AppService} from './app.service.js'

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
      try {
        appController.notImplemented()
        expect.unreachable('Should have thrown NotFoundException')
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException)
        expect((error as NotFoundException).getStatus()).toBe(
          HttpStatus.NOT_FOUND
        )
        expect((error as NotFoundException).getResponse()).toEqual({
          error: 'Not found'
        })
      }
    })
  })
})
