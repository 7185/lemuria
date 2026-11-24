import {Controller, Get} from '@nestjs/common'
import {HealthCheckService, HealthIndicatorService} from '@nestjs/terminus'
import {DbService} from '../db/db.service.js'

@Controller()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly healthIndicator: HealthIndicatorService,
    private readonly db: DbService
  ) {}

  @Get('/livez')
  livenessCheck() {
    return {
      status: 'ok',
      info: {lemuria: {status: 'up'}},
      error: {},
      details: {lemuria: {status: 'up'}}
    }
  }

  @Get('/readyz')
  readinessCheck() {
    return this.health.check([
      () => {
        const indicator = this.healthIndicator.check('database')
        try {
          this.db.ping()
          return indicator.up()
        } catch (error) {
          return indicator.down({
            message: error instanceof Error ? error.message : String(error)
          })
        }
      }
    ])
  }
}
