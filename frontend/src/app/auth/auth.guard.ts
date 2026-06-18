import {inject} from '@angular/core'
import {Router} from '@angular/router'
import {AuthService} from './auth.service'

/**
 * Guard for routing
 */
export const AuthGuard = () => {
  const authSvc = inject(AuthService)
  const router = inject(Router)

  return authSvc.isLogged() || router.navigate(['login'])
}
