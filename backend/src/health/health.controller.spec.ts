import {HealthCheckService, HealthIndicatorService} from '@nestjs/terminus'
import {Test, TestingModule} from '@nestjs/testing'
import {DbService} from '../db/db.service.js'
import {HealthController} from './health.controller.js'

describe(HealthController.name, () => {
  let controller: HealthController
  let healthCheckService: HealthCheckService
  let dbService: {ping: ReturnType<typeof vi.fn>}

  beforeAll(async () => {
    const mockHealthCheckService = {
      check: vi.fn((checks: (() => unknown)[]) =>
        Promise.all(checks.map((c) => c()))
      )
    }
    dbService = {
      ping: vi.fn()
    }

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {provide: HealthCheckService, useValue: mockHealthCheckService},
        HealthIndicatorService,
        {provide: DbService, useValue: dbService}
      ]
    }).compile()

    controller = module.get<HealthController>(HealthController)
    healthCheckService = module.get<HealthCheckService>(HealthCheckService)
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
    it('should report database up when ping succeeds', async () => {
      dbService.ping.mockImplementation(() => undefined)

      const result = await controller.readinessCheck()

      expect(healthCheckService.check).toHaveBeenCalled()
      expect(dbService.ping).toHaveBeenCalled()
      expect(result).toEqual([{database: {status: 'up'}}])
    })

    it('should report database down when ping throws', async () => {
      dbService.ping.mockImplementation(() => {
        throw new Error('SQLite failure')
      })

      const result = await controller.readinessCheck()

      expect(result).toEqual([
        {database: {status: 'down', message: 'SQLite failure'}}
      ])
    })
  })
})
