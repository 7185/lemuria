import {Module} from '@nestjs/common'
import {DbService} from '../db/db.service.js'
import {UserModule} from '../user/user.module.js'
import {WorldController} from './world.controller.js'
import {WorldService} from './world.service.js'

@Module({
  imports: [UserModule],
  providers: [WorldService, DbService],
  controllers: [WorldController]
})
export class WorldModule {}
