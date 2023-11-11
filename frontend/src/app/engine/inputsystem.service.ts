import {inject, Injectable} from '@angular/core'
import {fromEvent} from 'rxjs'
import {filter, tap} from 'rxjs/operators'
import {SettingsService} from '../settings/settings.service'

export const enum PressedKey {
  nop = 0,
  moveFwd,
  moveBck,
  turnLft,
  turnRgt,
  moveLft,
  moveRgt,
  moveUp,
  moveDwn,
  lookUp,
  lookDwn,
  run,
  clip,
  side,
  jmp,
  cpy,
  del,
  esc,
  len
}

@Injectable({providedIn: 'root'})
export class InputSystemService {
  public controls: boolean[] = Array(PressedKey.len).fill(false)
  public keyUpEvent = fromEvent(window, 'keyup').pipe(
    filter(
      (e: KeyboardEvent) =>
        ['INPUT', 'TEXTAREA'].indexOf((e.target as HTMLElement).nodeName) === -1
    ),
    tap((e: KeyboardEvent) => {
      this.handleKeys(e.code, false)
      e.preventDefault()
    })
  )
  public keyDownEvent = fromEvent(window, 'keydown').pipe(
    filter(
      (e: KeyboardEvent) =>
        ['INPUT', 'TEXTAREA'].indexOf((e.target as HTMLElement).nodeName) === -1
    ),
    tap((e: KeyboardEvent) => {
      this.handleKeys(e.code, true)
      e.preventDefault()
    })
  )

  private readonly defaultKeymap = new Map([
    ['ArrowUp', PressedKey.moveFwd],
    ['KeyW', PressedKey.moveFwd],
    ['ArrowDown', PressedKey.moveBck],
    ['KeyS', PressedKey.moveBck],
    ['ArrowLeft', PressedKey.turnLft],
    ['KeyQ', PressedKey.turnLft],
    ['ArrowRight', PressedKey.turnRgt],
    ['KeyE', PressedKey.turnRgt],
    ['KeyA', PressedKey.moveLft],
    ['KeyD', PressedKey.moveRgt],
    ['PageUp', PressedKey.lookUp],
    ['PageDown', PressedKey.lookDwn],
    ['NumpadAdd', PressedKey.moveUp],
    ['NumpadSubtract', PressedKey.moveDwn],
    //['NumpadDivide', PressedKey.divide],
    //['NumpadMultiply', PressedKey.multiply],
    //['Home', PressedKey.home],
    //['End', PressedKey.end],
    ['ShiftLeft', PressedKey.clip],
    ['ShiftRight', PressedKey.clip],
    ['ControlLeft', PressedKey.run],
    ['ControlRight', PressedKey.run],
    ['Numpad0', PressedKey.jmp],
    ['Space', PressedKey.jmp],
    ['Escape', PressedKey.esc],
    ['Insert', PressedKey.cpy],
    ['Delete', PressedKey.del]
  ])

  private keyMap: Map<string, PressedKey>
  private settings = inject(SettingsService)

  constructor() {
    const savedKeyMap = this.settings.get('keymap')
    this.keyMap =
      savedKeyMap != null ? new Map(savedKeyMap) : new Map(this.defaultKeymap)
  }

  public clearKeys() {
    this.keyMap.clear()
    this.saveKeyMap()
  }

  public getKeyMap() {
    return this.keyMap
  }

  public getKey(k: string) {
    return this.keyMap.get(k)
  }

  public setDefault() {
    this.keyMap = new Map(this.defaultKeymap)
    this.saveKeyMap()
  }

  public mapKey(k: string, value: PressedKey) {
    this.keyMap.set(k, value)
    this.saveKeyMap()
  }

  public handleKeys(k: string, value: boolean) {
    const key = this.keyMap.get(k)
    if (key != null) {
      this.controls[key] = value
    }
  }

  private saveKeyMap() {
    this.settings.set('keymap', Array.from(this.keyMap.entries()))
  }
}
