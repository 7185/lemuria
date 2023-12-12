import {HttpService} from '@nestjs/axios'
import {Injectable} from '@nestjs/common'

@Injectable()
export class ProxyService {
  constructor(private readonly httpService: HttpService) {}

  proxify(url: string) {
    return this.httpService.get(url, {responseType: 'arraybuffer'})
  }
}
