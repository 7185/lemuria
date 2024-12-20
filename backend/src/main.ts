import {join} from 'node:path'
import {NestFactory} from '@nestjs/core'
import {FastifyAdapter, NestFastifyApplication} from '@nestjs/platform-fastify'
import {WsAdapter} from '@nestjs/platform-ws'
import {fastifyCookie} from '@fastify/cookie'
import {AppModule} from './app.module'
import {config} from './app.config'
import {Logger} from 'nestjs-pino'

const bootstrap = async () => {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: false,
      // allow trailing slashes
      ignoreTrailingSlash: true
    }),
    {
      bufferLogs: true
    }
  )
  app.useStaticAssets({
    root: join(__dirname, '../static', 'browser'),
    prefixAvoidTrailingSlash: true
  })
  app.useWebSocketAdapter(new WsAdapter(app))
  app.register(fastifyCookie, {
    secret: config.secret
  })
  app.useLogger(app.get(Logger))

  await app.listen(8080, '0.0.0.0')
}
bootstrap()
