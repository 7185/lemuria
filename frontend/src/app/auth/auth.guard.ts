import {inject} from '@angular/core'
import {Router} from '@angular/router'
import {HttpService} from '../network/http.service'

/**
 * Guard for routing
 */
export const AuthGuard = () => {
  const http = inject(HttpService)
  const router = inject(Router)

  if (!http.isLogged()) {
    router.navigate(['login'])
  }
  return http.isLogged()
}
