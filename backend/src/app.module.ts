import {Module} from '@nestjs/common'
import {CacheModule} from '@nestjs/cache-manager'
import {ServeStaticModule} from '@nestjs/serve-static'
import {JwtService} from '@nestjs/jwt'
import {AppController} from './app.controller'
import {AppService} from './app.service'
import {WsGateway} from './ws/ws.gateway'
import {join} from 'path'
import {UserModule} from './user/user.module'
import {WorldModule} from './world/world.module'
import {config} from './app.config'

@Module({
  imports: [
    CacheModule.register({
      isGlobal: true,
      ttl: config.cache.timeout * 1000,
      max: config.cache.threshold
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'static', 'browser')
    }),
    UserModule,
    WorldModule
  ],
  controllers: [AppController],
  providers: [AppService, JwtService, WsGateway]
})
export class AppModule {}
