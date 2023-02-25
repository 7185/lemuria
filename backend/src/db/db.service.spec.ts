import {NestFastifyApplication} from '@nestjs/platform-fastify'
import {Test, TestingModule} from '@nestjs/testing'
import {DbService} from './db.service'

describe('DbService', () => {
  const MockApp = jest.fn<Partial<NestFastifyApplication>, []>(() => ({
    close: jest.fn()
  }))
  let service: DbService
  let app: NestFastifyApplication

  beforeEach(async () => {
    app = MockApp() as NestFastifyApplication
    const module: TestingModule = await Test.createTestingModule({
      providers: [DbService]
    }).compile()

    service = module.get<DbService>(DbService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('onModuleInit', () => {
    it('should call $connect', async () => {
      const spy = jest
        .spyOn(DbService.prototype, '$connect')
        .mockImplementation(async () => Promise.resolve())

      await service.onModuleInit()

      expect(spy).toBeCalledTimes(1)
      expect(service.$connect).toBeCalledTimes(1)
      spy.mockRestore()
    })
  })

  describe('enableShutdownHooks', () => {
    it('should call $on and successfully close the app', async () => {
      const spy = jest
        .spyOn(DbService.prototype, '$on')
        .mockImplementation(async (_, cb) => cb(() => Promise.resolve()))

      await service.enableShutdownHooks(app)

      expect(spy).toBeCalledTimes(1)
      expect(app.close).toBeCalledTimes(1)
      spy.mockRestore()
    })
  })
})
