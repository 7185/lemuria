import {All, Controller, Get, NotFoundException, Redirect} from '@nestjs/common'
import {AppService} from './app.service.js'

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @All('/api/{*path}')
  notImplemented() {
    throw new NotFoundException({error: 'Not found'})
  }

  @Get('/login')
  @Redirect('/')
  redirect() {
    return
  }
}
