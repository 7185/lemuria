import {Test, TestingModule} from '@nestjs/testing'
import {DbService} from './db.service'

describe('DbService', () => {
  let service: DbService

  beforeEach(async () => {
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
      const spy = vi
        .spyOn(DbService.prototype, '$connect')
        .mockImplementation(async () => Promise.resolve())

      await service.onModuleInit()

      expect(spy).toBeCalledTimes(1)
      expect(service.$connect).toBeCalledTimes(1)
      spy.mockRestore()
    })
  })
})
