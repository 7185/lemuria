import {Module} from '@nestjs/common'
import {WorldService} from './world.service'
import {WorldController} from './world.controller'
import {DbService} from '../db/db.service'

@Module({
  providers: [WorldService, DbService],
  controllers: [WorldController]
})
export class WorldModule {}
