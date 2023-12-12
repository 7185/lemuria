import {Test, TestingModule} from '@nestjs/testing'
import {HttpModule} from '@nestjs/axios'
import {CACHE_MANAGER} from '@nestjs/cache-manager'
import {ProxyController} from './proxy.controller'
import {ProxyService} from './proxy.service'

describe('ProxyController', () => {
  let controller: ProxyController

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [HttpModule],
      controllers: [ProxyController],
      providers: [ProxyService, {provide: CACHE_MANAGER, useFactory: jest.fn()}]
    }).compile()

    controller = module.get<ProxyController>(ProxyController)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })
})
