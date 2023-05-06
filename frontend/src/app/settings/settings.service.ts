import {Injectable} from '@angular/core'
import {BehaviorSubject} from 'rxjs'

@Injectable({providedIn: 'root'})
export class SettingsService {
  public updated = new BehaviorSubject(true)

  set(key: string, value: string): void {
    window.localStorage.setItem(key, value)
    this.updated.next(true)
  }

  get(key: string): string {
    return window.localStorage.getItem(key)
  }

  clear() {
    window.localStorage.clear()
  }
}
