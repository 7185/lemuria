import {Injectable} from '@angular/core'

@Injectable({providedIn: 'root'})
export class SettingsService {
  constructor() {}

  set(key: string, value: string): void {
    window.localStorage.setItem(key, value)
  }

  get(key: string): any {
    return window.localStorage.getItem(key)
  }

  clear() {
    window.localStorage.clear()
  }
}
