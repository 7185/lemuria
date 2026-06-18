import type {HttpInterceptorFn, HttpResponse} from '@angular/common/http'
import {HttpErrorResponse} from '@angular/common/http'
import {inject} from '@angular/core'
import {catchError, EMPTY, mergeMap, throwError} from 'rxjs'
import {environment} from '../../environments/environment'
import {AuthService} from '../auth/auth.service'

const authUrl = `${environment.url.server}/auth`

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const authSvc: AuthService = inject(AuthService)

  return next(req).pipe(
    catchError((err) => {
      if (
        err.status === 401 &&
        !(req.url.startsWith(authUrl) && req.method !== 'GET')
      ) {
        return renewCookie(authSvc).pipe(mergeMap(() => next(req)))
      }
      if (
        err instanceof HttpErrorResponse &&
        (err.status === 0 || err.status === 502)
      ) {
        return EMPTY
      }
      return throwError(() => err)
    })
  )
}

const renewCookie = (authSvc: AuthService) => {
  if (!authSvc.isLogged()) {
    // disconnect if session is marked as expired
    authSvc.logout().subscribe()
    return EMPTY
  }
  authSvc.expiration = Math.floor(new Date().getTime() / 1000) + 36000
  return authSvc.renewSession().pipe(
    catchError((refreshError: HttpResponse<unknown>) => {
      authSvc.logout().subscribe()
      return throwError(() => refreshError)
    })
  )
}
