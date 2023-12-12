import {Controller, Get, Query, Res} from '@nestjs/common'
import type {FastifyReply} from 'fastify'
import {ProxyService} from './proxy.service'

@Controller('/api/v1/proxy')
export class ProxyController {
  constructor(private readonly proxyService: ProxyService) {}

  @Get('archive')
  async imgArchive(
    @Query()
    query: {
      url: string
      date: string
    },
    @Res() res: FastifyReply
  ) {
    return res.status(404).send({})
  }

  @Get('url')
  async imgProxy(
    @Query()
    query: {
      url: string
    },
    @Res() res: FastifyReply
  ) {
    this.proxyService.proxify(query.url).subscribe({
      next: (data) =>
        res
          .status(200)
          .headers({'content-type': data.headers['content-type']})
          .send(data.data),
      error: () => res.status(404).send({})
    })
  }
}
