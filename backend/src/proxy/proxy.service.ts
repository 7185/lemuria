import {HttpService} from '@nestjs/axios'
import {Injectable, Inject} from '@nestjs/common'
import {CACHE_MANAGER} from '@nestjs/cache-manager'
import {map, of} from 'rxjs'
import {Cache} from 'cache-manager'

@Injectable()
export class ProxyService {
  constructor(
    @Inject(CACHE_MANAGER) private cache: Cache,
    private readonly httpService: HttpService
  ) {}

  proxify(url: string) {
    return this.httpService.get(url, {responseType: 'arraybuffer'})
  }

  async archive(url: string, date: string) {
    const cacheKey = `U-${url}`
    const cachedUrl = await this.cache.get(cacheKey)

    if (cachedUrl != null) {
      return of(cachedUrl ? {url: cachedUrl} : {})
    }

    return this.httpService
      .get(`https://archive.org/wayback/available?url=${url}&timestamp=${date}`)
      .pipe(
        map(async (req) => {
          if (req.status === 200) {
            try {
              const archivedUrl =
                req.data.archived_snapshots.closest.url.replace(
                  '/http',
                  'im_/http'
                )
              await this.cache.set(cacheKey, archivedUrl)
              return {url: archivedUrl}
            } catch {
              await this.cache.set(cacheKey, '')
              return {}
            }
          } else {
            await this.cache.set(cacheKey, '')
            return {}
          }
        })
      )
  }
}
