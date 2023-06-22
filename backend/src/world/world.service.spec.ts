import {DbService} from '../db/db.service'
import {Test, TestingModule} from '@nestjs/testing'
import {CACHE_MANAGER} from '@nestjs/cache-manager'
import {WorldService} from './world.service'

describe('WorldService', () => {
  let service: WorldService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorldService,
        DbService,
        {provide: CACHE_MANAGER, useFactory: jest.fn()}
      ]
    }).compile()

    service = module.get<WorldService>(WorldService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})
