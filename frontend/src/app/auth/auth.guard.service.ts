import {Injectable} from '@angular/core'
import {Router} from '@angular/router'

import {HttpService} from '../network/http.service'

/**
 * Guard for routing
 */
@Injectable({providedIn: 'root'})
export class AuthGuard {
  constructor(private router: Router, private http: HttpService) {}

  canActivate(): boolean {
    if (!this.http.isLogged()) {
      this.router.navigate(['login'])
    }
    return this.http.isLogged()
  }
}
