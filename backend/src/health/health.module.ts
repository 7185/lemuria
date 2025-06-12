import {Module} from '@nestjs/common'
import {TerminusModule} from '@nestjs/terminus'
import {HealthController} from './health.controller'
import {DbService} from '../db/db.service'

@Module({
  imports: [TerminusModule],
  providers: [DbService],
  controllers: [HealthController]
})
export class HealthModule {}
