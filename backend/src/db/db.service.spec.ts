import {Test, TestingModule} from '@nestjs/testing'
import {DbService} from './db.service.js'

describe('DbService', () => {
  let service: DbService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DbService]
    }).compile()

    service = module.get<DbService>(DbService)
  })

  afterEach(() => {
    service.onModuleDestroy()
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
    expect(service.db).toBeDefined()
  })

  describe('ping', () => {
    it('should execute a ping query without throwing', () => {
      expect(() => service.ping()).not.toThrow()
    })
  })
})
