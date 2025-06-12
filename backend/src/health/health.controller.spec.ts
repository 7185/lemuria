import {Test, TestingModule} from '@nestjs/testing'
import {HealthController} from './health.controller'
import {HealthCheckService, PrismaHealthIndicator} from '@nestjs/terminus'
import {DbService} from '../db/db.service'

describe(HealthController.name, () => {
  let controller: HealthController
  let healthCheckService: HealthCheckService
  let prismaHealthIndicator: PrismaHealthIndicator

  beforeAll(async () => {
    const mockHealthCheckService = {
      check: vitest.fn()
    }
    const mockPrismaHealthIndicator = {
      pingCheck: vitest.fn()
    }
    const mockDbService = {}

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {provide: HealthCheckService, useValue: mockHealthCheckService},
        {provide: PrismaHealthIndicator, useValue: mockPrismaHealthIndicator},
        {provide: DbService, useValue: mockDbService}
      ]
    }).compile()

    controller = module.get<HealthController>(HealthController)
    healthCheckService = module.get<HealthCheckService>(HealthCheckService)
    prismaHealthIndicator = module.get<PrismaHealthIndicator>(
      PrismaHealthIndicator
    )
  })

  describe('livenessCheck', () => {
    it('should return static liveness status', () => {
      const expected = {
        status: 'ok',
        info: {lemuria: {status: 'up'}},
        error: {},
        details: {lemuria: {status: 'up'}}
      }
      expect(controller.livenessCheck()).toEqual(expected)
    })
  })

  describe('readinessCheck', () => {
    it('should call health.check with prismaHealth.pingCheck', async () => {
      const expectedResult = {status: 'ok', info: {database: {status: 'ok'}}}
      prismaHealthIndicator.pingCheck = vitest.fn()
      healthCheckService.check = vitest.fn().mockResolvedValue(expectedResult)

      const result = await controller.readinessCheck()

      expect(healthCheckService.check).toHaveBeenCalled()
      expect(result).toEqual(expectedResult)
    })
  })
})
