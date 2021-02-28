import {Injectable} from '@angular/core'
import {HttpClient, HttpHandler} from '@angular/common/http'
import {config} from '../app.config'


@Injectable({providedIn: 'root'})
export class HttpService extends HttpClient {
  private baseUrl = config.url.server

  constructor(private httpHandler: HttpHandler) {
    super(httpHandler)
  }

  public static getCookie(name: string) {
    const c = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)')
    return c ? c.pop() : ''
  }

  public login(login: string, password: string) {
    return this.post(`${this.baseUrl}/auth`, {login, password})
  }

  public world(world: string) {
    return this.get(`${this.baseUrl}/world/${world}`)
  }
}
