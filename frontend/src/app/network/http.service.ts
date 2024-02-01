import {BehaviorSubject, throwError} from 'rxjs'
import type {Observable} from 'rxjs'
import {Injectable} from '@angular/core'
import {HttpClient, HttpHandler} from '@angular/common/http'
import type {HttpResponse} from '@angular/common/http'
import {Router} from '@angular/router'
import {environment} from '../../environments/environment'
import {User} from '../user'
import {catchError, tap, map} from 'rxjs/operators'

@Injectable({providedIn: 'root'})
export class HttpService extends HttpClient {
  private baseUrl = environment.url.server
  private userLogged: BehaviorSubject<User> = new BehaviorSubject<User>(
    new User()
  )
  private mExpiration = parseInt(localStorage.getItem('expiration') ?? '0', 10)

  constructor(
    private httpHandler: HttpHandler,
    private router: Router
  ) {
    super(httpHandler)
  }

  get expiration(): number {
    return this.mExpiration
  }

  set expiration(value: number) {
    this.mExpiration = value
    localStorage.setItem('expiration', value.toString())
  }

  public static getCookie(name: string) {
    const c = RegExp('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)').exec(
      document.cookie
    )
    return c ? c.pop() : ''
  }

  isLogged(): boolean {
    return !this.hasExpired()
  }

  setLogged(logged: User): void {
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
    return this.post(`${this.baseUrl}/auth/`, {login, password}).pipe(
      tap((data) => {
        this.expiration = Math.floor(new Date().getTime() / 1000) + 36000
        this.setLogged(new User(data))
      })
    )
  }

  public logout() {
    this.expiration = 0
    return this.delete(`${this.baseUrl}/auth/`).pipe(
      tap(() => {
        this.setLogged(new User())
        this.router.navigate(['login'])
      })
    )
  }

  public session() {
    return this.get(`${this.baseUrl}/auth/`).pipe(
      catchError((error: HttpResponse<unknown>) => {
        this.logout().subscribe()
        return throwError(() => error)
      }),
      tap((data) => this.setLogged(new User(data)))
    )
  }

  public avatars(path: string) {
    const list: {
      name: string
      geometry: string
      implicit: Map<string, string>
      explicit: Map<string, string>
    }[] = []
    let readImp = false
    let readExp = false
    return this.get(`${path}/avatars/avatars.dat`, {responseType: 'text'}).pipe(
      map((a: string) => {
        a.split('\n')
          .map((l: string) => l.trim())
          .forEach((line: string) => {
            const i = list.length - 1
            if (line === 'avatar') {
              list.push({
                name: '',
                geometry: '',
                implicit: new Map(),
                explicit: new Map()
              })
            } else if (line.startsWith('name=')) {
              list[i].name = line.substring(5)
            } else if (line.startsWith('geometry=')) {
              list[i].geometry = line.substring(9)
            }
            if (line.startsWith('beginimp')) {
              readImp = true
            } else if (line.startsWith('endimp')) {
              readImp = false
            } else if (line.startsWith('beginexp')) {
              readExp = true
            } else if (line.startsWith('endexp')) {
              readExp = false
            } else {
              const values = line.split('=')
              if (readImp && values.length === 2) {
                list[i].implicit.set(values[0], values[1])
              } else if (readExp && values.length === 2) {
                list[i].explicit.set(values[0], values[1])
              }
            }
          })
        return list
      })
    )
  }

  public world(worldId: number) {
    return this.get(`${this.baseUrl}/world/${worldId}`)
  }

  public props(
    worldId: number,
    minX: number | null,
    maxX: number | null,
    minY: number | null,
    maxY: number | null,
    minZ: number | null,
    maxZ: number | null
  ) {
    // Craft params for props GET request
    const opts: {
      params: {
        min_x?: number
        max_x?: number
        min_y?: number
        max_y?: number
        min_z?: number
        max_z?: number
      }
    } = {
      params: {}
    }

    if (minX != null) {
      opts.params.min_x = minX
    }
    if (maxX != null) {
      opts.params.max_x = maxX
    }
    if (minY != null) {
      opts.params.min_y = minY
    }
    if (maxY != null) {
      opts.params.max_y = maxY
    }
    if (minZ != null) {
      opts.params.min_z = minZ
    }
    if (maxZ != null) {
      opts.params.max_z = maxZ
    }

    return this.get(`${this.baseUrl}/world/${worldId}/props`, opts)
  }

  public worlds() {
    return this.get(`${this.baseUrl}/world/`)
  }

  public terrain(worldId: number, pageX: number, pageZ: number) {
    return this.get(`${this.baseUrl}/world/${worldId}/terrain`, {
      params: {page_x: pageX, page_z: pageZ}
    })
  }

  private hasExpired(): boolean {
    return (
      this.expiration === 0 || Math.floor(Date.now() / 1000) >= this.expiration
    )
  }
}
