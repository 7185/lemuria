import {Injectable, Injector} from '@angular/core'
import {HttpErrorResponse, HttpHeaders} from '@angular/common/http'
import type {HttpEvent, HttpHandler, HttpInterceptor, HttpRequest, HttpResponse} from '@angular/common/http'
import {HttpService} from './http.service'
import {EMPTY, throwError} from 'rxjs'
import type {Observable} from 'rxjs'
import {config} from '../app.config'
import {catchError, mergeMap} from 'rxjs/operators'


@Injectable()
export class JwtInterceptor implements HttpInterceptor {
  private authUrl = `${config.url.server}/auth`

  constructor(private injector: Injector) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(req)
      .pipe(
        catchError(err => {
          if (err.status === 401 && !(req.url.startsWith(this.authUrl) && req.method !== 'GET')) {
            return this.renewCookie(req)
              .pipe(
                mergeMap(() => next.handle(req))
              )
          }
          if (err instanceof HttpErrorResponse) {
            if (err.status === 0 || err.status === 502) {
              console.log('Connection lost')
            }
          }
          return throwError(() => err)
        })
      )
  }

  renewCookie(_: HttpRequest<any>): Observable<any> {
    // Get HttpService here to avoid cyclic dependency (angular issue #18224)
    const http: HttpService = this.injector.get(HttpService)
    if (!http.isLogged()) {
      // disconnect if session is marked as expired
      http.logout().subscribe()
      return EMPTY
    }
    http.expiration = Math.floor(new Date().getTime() / 1000) + 36000
    const headers = new HttpHeaders().set('X-CSRF-TOKEN', HttpService.getCookie(config.csrf.renew))
    return http.post(`${this.authUrl}/renew`, null, {headers})
      .pipe(
        catchError((refreshError: HttpResponse<any>) => {
          http.logout().subscribe()
          return throwError(() => refreshError)
        })
      )
  }
}
