import {Module} from '@nestjs/common'
import {HttpModule} from '@nestjs/axios'
import {ProxyService} from './proxy.service'
import {ProxyController} from './proxy.controller'

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
