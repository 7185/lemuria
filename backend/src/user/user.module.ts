import {Module} from '@nestjs/common'
import {JwtModule} from '@nestjs/jwt'
import {UserService} from './user.service'
import {UserController} from './user.controller'

@Module({
  imports: [JwtModule.register({secret: '**changeme**'})],
  providers: [UserService],
  controllers: [UserController],
  exports: [UserService]
})
export class UserModule {}
