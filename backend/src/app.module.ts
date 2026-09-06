import {CacheModule} from '@nestjs/cache-manager'
import {Module} from '@nestjs/common'
import {ConfigModule} from '@nestjs/config'
import {JwtService} from '@nestjs/jwt'
import {LoggerModule} from 'nestjs-pino'
import {config} from './app.config.js'
import {AppController} from './app.controller.js'
import {AppService} from './app.service.js'
import {HealthModule} from './health/health.module.js'
import {ProxyModule} from './proxy/proxy.module.js'
import {UserModule} from './user/user.module.js'
import {WorldModule} from './world/world.module.js'
import {WsGateway} from './ws/ws.gateway.js'

@Module({
  imports: [
    CacheModule.register({
      isGlobal: true,
      ttl: config.cache.timeout * 1000,
      max: config.cache.threshold
    }),
    ConfigModule.forRoot({
      isGlobal: true
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        quietReqLogger: true,
        customProps: (req) => ({
          context: 'HTTP',
          userAgent: req.headers['user-agent']
        }),
        customLogLevel: (_req, res, err) => {
          if (res.statusCode >= 500 || err) {
            return 'error'
          } else if (res.statusCode >= 400) {
            return 'warn'
          } else if (res.statusCode >= 300) {
            return 'silent'
          }
          return 'info'
        },
        customSuccessMessage: (req, res) =>
          `${req.socket['remoteAddress']}:${req.socket['remotePort']} ${req.method} ${req.url} ${req['httpVersion']} ${res.statusCode}`,
        serializers: {
          res(reply) {
            return {contentLength: reply.raw['_contentLength']}
          }
        },
        transport: {
          target: 'pino-pretty',
          options: {
            ignore: 'hostname,context,reqId,req,res,userAgent,responseTime',
            translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
            messageFormat:
              '[{context}] {msg}{if res.contentLength} {res.contentLength}{end}{if res} {responseTime}ms{end}'
          }
        }
      }
    }),
    ProxyModule,
    UserModule,
    WorldModule,
    HealthModule
  ],
  controllers: [AppController],
  providers: [AppService, JwtService, WsGateway]
})
export class AppModule {}
