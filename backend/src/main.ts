import {NestFactory} from '@nestjs/core'
import {NestNodeApplication, NodeAdapter} from '@nestjs/platform-node'
import {WsAdapter} from '@nestjs/platform-ws'
import {Logger} from 'nestjs-pino'
import {config} from './app.config.js'
import {AppModule} from './app.module.js'
import {getSecretKey} from './utils/utils.js'

const bootstrap = async () => {
  const app = await NestFactory.create<NestNodeApplication>(
    AppModule,
    new NodeAdapter(),
    {
      bufferLogs: true,
      cookies: {
        secret: getSecretKey() ?? config.secret
      }
    }
  )

  app.useLogger(app.get(Logger))
  app.useWebSocketAdapter(new WsAdapter(app))

  await app.listen(8080, '0.0.0.0')
}
bootstrap()
