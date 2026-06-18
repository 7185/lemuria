import type {HttpResponse} from '@angular/common/http'
import {HttpHeaders} from '@angular/common/http'
import {HttpClient} from '@angular/common/http'
import {computed, inject, Service, signal} from '@angular/core'
import {Router} from '@angular/router'
import {catchError, tap, throwError} from 'rxjs'
import {environment} from '../../environments/environment'
import {SettingsService} from '../settings/settings.service'
import {User} from '../user'
import {getCookie} from '../utils/utils'

@Service()
export class AuthService {
  private readonly http = inject(HttpClient)
  private baseUrl = environment.url.server
  private userLogged = signal<User>(new User())
  isLogged = computed(() => Math.floor(Date.now() / 1000) < this.#expiration())

  private readonly router = inject(Router)
  private readonly settings = inject(SettingsService)
  #expiration = signal(this.settings.get('expiration') ?? 0)

  get expiration(): number {
    return this.#expiration()
  }

  set expiration(value: number) {
    this.#expiration.set(value)
    this.settings.set('expiration', value)
  }

  getLogged() {
    if (!this.userLogged().id) {
      this.session().subscribe()
    }
    return this.userLogged
  }

  login(login: string, password: string) {
    return this.http.post(`${this.baseUrl}/auth/`, {login, password}).pipe(
      tap((data) => {
        this.expiration = Math.floor(new Date().getTime() / 1000) + 36000
        this.userLogged.set(new User(data))
      })
    )
  }

  logout() {
    this.expiration = 0
    return this.http.delete(`${this.baseUrl}/auth/`).pipe(
      tap(() => {
        this.userLogged.set(new User())
        this.router.navigate(['login'])
      })
    )
  }

  session() {
    return this.http.get(`${this.baseUrl}/auth/`).pipe(
      catchError((error: HttpResponse<unknown>) => {
        this.logout().subscribe()
        return throwError(() => error)
      }),
      tap((data) => this.userLogged.set(new User(data)))
    )
  }

  renewSession() {
    this.expiration = Math.floor(Date.now() / 1000) + 36000
    const headers = new HttpHeaders().set(
      'X-CSRF-TOKEN',
      getCookie(environment.csrf.renew)
    )
    return this.http.post(`${this.baseUrl}/auth/renew`, null, {headers})
  }
}
