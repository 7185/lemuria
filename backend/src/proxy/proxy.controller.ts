import type {NodeResponse} from '@nestjs/platform-node'
import {Controller, Get, HttpStatus, Query, Res} from '@nestjs/common'
import {from, mergeMap} from 'rxjs'
import {ProxyService} from './proxy.service.js'

@Controller('/api/v1/proxy')
export class ProxyController {
  constructor(private readonly proxyService: ProxyService) {}

  @Get('archive')
  async mediaArchive(
    @Query()
    query: {
      url: string
      date: string
    },
    @Res() res: NodeResponse
  ) {
    from(this.proxyService.archive(query.url, query.date))
      .pipe(mergeMap((archiveResult) => archiveResult))
      .subscribe({
        next: async (urlPromise) => {
          const url = await urlPromise
          if (Object.keys(url).length > 0) {
            res.status(HttpStatus.OK).send(url)
          } else {
            res.status(HttpStatus.NOT_FOUND).send({})
          }
        },
        error: () => {
          res.status(HttpStatus.NOT_FOUND).send({})
        }
      })
  }

  @Get('url')
  async mediaProxy(
    @Query()
    query: {
      url: string
    },
    @Res() res: NodeResponse
  ) {
    this.proxyService.proxify(query.url).subscribe({
      next: (data) => {
        res.setHeader(
          'content-type',
          (data.headers['content-type'] as string) ?? 'application/octet-stream'
        )
        res.status(HttpStatus.OK).send(Buffer.from(data.data))
      },
      error: () => res.status(HttpStatus.NOT_FOUND).send({})
    })
  }
}
