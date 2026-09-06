import {Module} from '@nestjs/common'
import {JwtModule} from '@nestjs/jwt'
import {config} from '../app.config.js'
import {UserController} from './user.controller.js'
import {UserService} from './user.service.js'

@Module({
  imports: [JwtModule.register({secret: config.secret})],
  providers: [UserService],
  controllers: [UserController],
  exports: [UserService]
})
export class UserModule {}
