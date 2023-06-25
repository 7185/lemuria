import {Module} from '@nestjs/common'
import {JwtModule} from '@nestjs/jwt'
import {UserService} from './user.service'
import {UserController} from './user.controller'
import {config} from '../app.config'

@Module({
  imports: [JwtModule.register({secret: config.secret})],
  providers: [UserService],
  controllers: [UserController],
  exports: [UserService]
})
export class UserModule {}
