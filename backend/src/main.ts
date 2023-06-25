import {NestFactory} from '@nestjs/core'
import {FastifyAdapter, NestFastifyApplication} from '@nestjs/platform-fastify'
import {WsAdapter} from '@nestjs/platform-ws'
import {fastifyCookie} from '@fastify/cookie'
import {AppModule} from './app.module'
import {config} from './app.config'

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      // allow trailing slashes
      ignoreTrailingSlash: true
    })
  )

  app.useWebSocketAdapter(new WsAdapter(app))
  app.register(fastifyCookie, {
    secret: config.secret
  })

  await app.listen(8080, '0.0.0.0')
}
bootstrap()
