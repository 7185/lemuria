import {Injectable} from '@angular/core'
import {BehaviorSubject} from 'rxjs'

@Injectable({providedIn: 'root'})
export class SettingsService {
  public updated = new BehaviorSubject(true)

  set(key: string, value: any): void {
    window.localStorage.setItem(key, JSON.stringify(value))
    this.updated.next(true)
  }

  get(key: string): any {
    return JSON.parse(window.localStorage.getItem(key))
  }

  clear() {
    window.localStorage.clear()
  }
}
