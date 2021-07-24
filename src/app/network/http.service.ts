import {BehaviorSubject, Observable, throwError} from 'rxjs'
import {Injectable} from '@angular/core'
import {HttpClient, HttpHandler, HttpResponse} from '@angular/common/http'
import {Router} from '@angular/router'
import {config} from '../app.config'
import {User} from '../user/user.model'
import {catchError, tap, map} from 'rxjs/operators'


@Injectable({providedIn: 'root'})
export class HttpService extends HttpClient {
  private baseUrl = config.url.server
  private currentUser = new User()
  private userLogged: BehaviorSubject<User> = new BehaviorSubject<User>(this.currentUser)
  private mExpiration: number

  constructor(private httpHandler: HttpHandler, private router: Router) {
    super(httpHandler)
    this.mExpiration = parseInt(localStorage.getItem('expiration'), 10) || 0
  }

  public static getCookie(name: string) {
    const c = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)')
    return c ? c.pop() : ''
  }

  get expiration(): number {
    return this.mExpiration
  }

  set expiration(value: number) {
    this.mExpiration = value
    localStorage.setItem('expiration', value.toString())
  }

  isLogged(): boolean {
    return !this.hasExpired()
  }

  setLogged(logged: User): void {
    this.currentUser = logged
    this.userLogged.next(logged)
  }

  getLogged(): Observable<User> {
    if (this.userLogged.value.id == null) {
      this.session().subscribe()
    }
    return this.userLogged.asObservable()
  }

  public login(login: string, password: string) {
    localStorage.setItem('login', login)
    return this.post(`${this.baseUrl}/auth`, {login, password}).pipe(
      tap(data => {
        this.expiration = Math.floor(new Date().getTime() / 1000) + 36000
        this.setLogged(new User(data))
      })
    )
  }

  public logout() {
    this.expiration = 0
    return this.delete(`${this.baseUrl}/auth`).pipe(
      tap(data => {
        this.setLogged(new User())
        this.router.navigate(['login'])
      })
    )
  }

  public session() {
    return this.get(`${this.baseUrl}/auth`).pipe(
      catchError((error: HttpResponse<any>) => {
        this.logout().subscribe()
        return throwError(error)
      }),
      tap(data => this.setLogged(new User(data)))
    )
  }

  public avatars(path: string) {
    return this.get(`${path}/avatars/avatars.dat`, {responseType: 'text'}).pipe(
      map((a: any) => {
        const list = []
        a.split('\n').map((l: string) => l.trim()).forEach((line: string) => {
          const i = list.length - 1
          if (line === 'avatar') {
            list.push({name: '', geometry: ''})
          }
          if (line.startsWith('name=')) {
            list[i].name = line.substring(5)
          }
          if (line.startsWith('geometry=')) {
            list[i].geometry = line.substring(9)
          }
        })
        return list
      })
    )
  }

  public world(worldId: number) {
    return this.get(`${this.baseUrl}/world/${worldId}`)
  }

  public worlds() {
    return this.get(`${this.baseUrl}/world/`)
  }

  private hasExpired(): boolean {
    if (this.expiration === 0) {
      return true
    }
    return Math.floor(new Date().getTime() / 1000) >= this.expiration
  }
}
