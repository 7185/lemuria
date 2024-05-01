import {Injectable} from '@angular/core'
import {BehaviorSubject} from 'rxjs'

@Injectable({providedIn: 'root'})
export class SettingsService {
  updated = new BehaviorSubject(true)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  set(key: string, value: any): void {
    window.localStorage.setItem(key, JSON.stringify(value))
    this.updated.next(true)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get(key: string): any {
    return JSON.parse(window.localStorage.getItem(key))
  }

  clear() {
    window.localStorage.clear()
  }
}
