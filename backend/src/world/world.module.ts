import {Module} from '@nestjs/common'
import {DbService} from '../db/db.service'
import {UserModule} from '../user/user.module'
import {WorldController} from './world.controller'
import {WorldService} from './world.service'

@Module({
  imports: [UserModule],
  providers: [WorldService, DbService],
  controllers: [WorldController]
})
export class WorldModule {}
