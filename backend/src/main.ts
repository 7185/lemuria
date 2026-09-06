import {fastifyCookie} from '@fastify/cookie'
import {fastifyStatic} from '@fastify/static'
import {NestFactory} from '@nestjs/core'
import {FastifyAdapter, NestFastifyApplication} from '@nestjs/platform-fastify'
import {WsAdapter} from '@nestjs/platform-ws'
import {Logger} from 'nestjs-pino'
import {join} from 'node:path'
import {config} from './app.config.js'
import {AppModule} from './app.module.js'
import {getSecretKey} from './utils/utils.js'

const bootstrap = async () => {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: false,
      routerOptions: {
        // allow trailing slashes in routes
        ignoreTrailingSlash: true
      }
    }),
    {
      bufferLogs: true
    }
  )

  app.useLogger(app.get(Logger))
  await app.register(fastifyStatic, {
    root: join(import.meta.dirname, '../../static/browser'),
    prefixAvoidTrailingSlash: true
  })
  app.useWebSocketAdapter(new WsAdapter(app))
  await app.register(fastifyCookie, {
    secret: getSecretKey() ?? config.secret
  })

  await app.listen(8080, '0.0.0.0')
}
bootstrap()
