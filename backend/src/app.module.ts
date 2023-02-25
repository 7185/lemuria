import {Module} from '@nestjs/common'
import {ServeStaticModule} from '@nestjs/serve-static'
import {JwtService} from '@nestjs/jwt'
import {AppController} from './app.controller'
import {AppService} from './app.service'
import {WsGateway} from './ws/ws.gateway'
import {join} from 'path'
import {UserModule} from './user/user.module'
import {WorldModule} from './world/world.module'

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'static')
    }),
    UserModule,
    WorldModule
  ],
  controllers: [AppController],
  providers: [AppService, JwtService, WsGateway]
})
export class AppModule {}
