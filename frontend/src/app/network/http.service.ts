import {throwError} from 'rxjs'
import {computed, inject, Injectable, signal} from '@angular/core'
import {HttpClient} from '@angular/common/http'
import type {HttpResponse} from '@angular/common/http'
import {Router} from '@angular/router'
import {environment} from '../../environments/environment'
import {User} from '../user'
import {catchError, map, tap} from 'rxjs/operators'

export type PropEntry = [
  number,
  number,
  string,
  number,
  number,
  number,
  number,
  number,
  number,
  string?,
  string?
]

export interface Avatar {
  name: string
  geometry: string
  implicit: Map<string, string>
  explicit: Map<string, string>
}

@Injectable({providedIn: 'root'})
export class HttpService extends HttpClient {
  private baseUrl = environment.url.server
  private userLogged = signal<User>(new User())
  #expiration = signal(parseInt(localStorage.getItem('expiration') ?? '0', 10))
  isLogged = computed(() => Math.floor(Date.now() / 1000) < this.#expiration())

  private readonly router = inject(Router)

  get expiration(): number {
    return this.#expiration()
  }

  set expiration(value: number) {
    this.#expiration.set(value)
    localStorage.setItem('expiration', value.toString())
  }

  static getCookie(name: string) {
    const c = RegExp('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)').exec(
      document.cookie
    )
    return c ? c.pop() : ''
  }

  getLogged() {
    if (!this.userLogged().id) {
      this.session().subscribe()
    }
    return this.userLogged
  }

  login(login: string, password: string) {
    return this.post(`${this.baseUrl}/auth/`, {login, password}).pipe(
      tap((data) => {
        this.expiration = Math.floor(new Date().getTime() / 1000) + 36000
        this.userLogged.set(new User(data))
      })
    )
  }

  logout() {
    this.expiration = 0
    return this.delete(`${this.baseUrl}/auth/`).pipe(
      tap(() => {
        this.userLogged.set(new User())
        this.router.navigate(['login'])
      })
    )
  }

  session() {
    return this.get(`${this.baseUrl}/auth/`).pipe(
      catchError((error: HttpResponse<unknown>) => {
        this.logout().subscribe()
        return throwError(() => error)
      }),
      tap((data) => this.userLogged.set(new User(data)))
    )
  }

  avatars(path: string) {
    const list: Avatar[] = []
    let [readImp, readExp] = [false, false]
    return this.get(`${path}/avatars/avatars.dat`, {responseType: 'text'}).pipe(
      map((fileContent: string) => {
        fileContent.split('\n').forEach((line: string) => {
          line = line.trim()
          const i = list.length - 1
          if (line === 'avatar') {
            list.push({
              name: '',
              geometry: '',
              implicit: new Map<string, string>(),
              explicit: new Map<string, string>()
            })
            return
          }
          if (line.startsWith('name=')) {
            list[i].name = line.substring(5)
          } else if (line.startsWith('geometry=')) {
            list[i].geometry = line.substring(9)
          } else if (line.startsWith('beginimp')) {
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

  world(worldId: number) {
    return this.get(`${this.baseUrl}/world/${worldId}`)
  }

  props(
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

    return this.get<{entries: PropEntry[]}>(
      `${this.baseUrl}/world/${worldId}/props`,
      opts
    )
  }

  worlds() {
    return this.get(`${this.baseUrl}/world/`)
  }

  terrain(worldId: number, pageX: number, pageZ: number) {
    return this.get(`${this.baseUrl}/world/${worldId}/terrain`, {
      params: {page_x: pageX, page_z: pageZ}
    })
  }
}
