import {Module} from '@nestjs/common'
import {TerminusModule} from '@nestjs/terminus'
import {DbService} from '../db/db.service'
import {HealthController} from './health.controller'

@Module({
  imports: [TerminusModule],
  providers: [DbService],
  controllers: [HealthController]
})
export class HealthModule {}
