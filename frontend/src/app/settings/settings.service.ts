import {Injectable} from '@angular/core'
import {BehaviorSubject} from 'rxjs'

@Injectable({providedIn: 'root'})
export class SettingsService {
  updated = new BehaviorSubject<void>(null)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  set(key: string, value: any): void {
    globalThis.localStorage.setItem(key, JSON.stringify(value))
    this.updated.next()
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get(key: string): any {
    return JSON.parse(globalThis.localStorage.getItem(key))
  }

  clear() {
    globalThis.localStorage.clear()
  }
}
