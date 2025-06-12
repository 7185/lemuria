import {Controller, Get} from '@nestjs/common'
import {HealthCheckService, PrismaHealthIndicator} from '@nestjs/terminus'
import {DbService} from '../db/db.service'

@Controller()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaHealth: PrismaHealthIndicator,
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
      () => this.prismaHealth.pingCheck('database', this.db)
    ])
  }
}
