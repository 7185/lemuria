import type {FastifyReply} from 'fastify'
import {All, Controller, Res} from '@nestjs/common'
import {AppService} from './app.service'

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @All('/api/*')
  notImplemented(@Res() res: FastifyReply) {
    return res.status(404).send({error: 'Not found'})
  }
}
