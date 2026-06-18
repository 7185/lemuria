import {HttpModule} from '@nestjs/axios'
import {Module} from '@nestjs/common'
import {ProxyController} from './proxy.controller'
import {ProxyService} from './proxy.service'

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
