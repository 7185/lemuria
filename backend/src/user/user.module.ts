import {Module} from '@nestjs/common'
import {JwtModule} from '@nestjs/jwt'
import {config} from '../app.config'
import {UserController} from './user.controller'
import {UserService} from './user.service'

@Module({
  imports: [JwtModule.register({secret: config.secret})],
  providers: [UserService],
  controllers: [UserController],
  exports: [UserService]
})
export class UserModule {}
