import {HttpModule} from '@nestjs/axios'
import {Module} from '@nestjs/common'
import {ProxyController} from './proxy.controller.js'
import {ProxyService} from './proxy.service.js'

@Module({
  imports: [
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 3
    })
  ],
  providers: [ProxyService],
  controllers: [ProxyController]
})
export class ProxyModule {}
