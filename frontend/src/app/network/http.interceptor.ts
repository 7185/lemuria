import {inject} from '@angular/core'
import {HttpErrorResponse, HttpHeaders} from '@angular/common/http'
import type {HttpInterceptorFn, HttpResponse} from '@angular/common/http'
import {HttpService} from './http.service'
import {EMPTY, throwError} from 'rxjs'
import {config} from '../app.config'
import {catchError, mergeMap} from 'rxjs/operators'

const authUrl = `${config.url.server}/auth`

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const http: HttpService = inject(HttpService)
  return next(req).pipe(
    catchError((err) => {
      if (
        err.status === 401 &&
        !(req.url.startsWith(authUrl) && req.method !== 'GET')
      ) {
        return renewCookie(http).pipe(mergeMap(() => next(req)))
      }
      if (
        err instanceof HttpErrorResponse &&
        (err.status === 0 || err.status === 502)
      ) {
        console.log('Connection lost')
      }
      return throwError(() => err)
    })
  )
}

const renewCookie = (http: HttpService) => {
  if (!http.isLogged()) {
    // disconnect if session is marked as expired
    http.logout().subscribe()
    return EMPTY
  }
  http.expiration = Math.floor(new Date().getTime() / 1000) + 36000
  const headers = new HttpHeaders().set(
    'X-CSRF-TOKEN',
    HttpService.getCookie(config.csrf.renew)
  )
  return http.post(`${authUrl}/renew`, null, {headers}).pipe(
    catchError((refreshError: HttpResponse<unknown>) => {
      http.logout().subscribe()
      return throwError(() => refreshError)
    })
  )
}
