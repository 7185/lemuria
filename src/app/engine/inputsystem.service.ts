import {Injectable} from '@angular/core'
import {fromEvent} from 'rxjs'
import {map} from 'rxjs/operators'

export const enum PressedKey { up = 0, right, down, left, pgUp, pgDown, plus, minus, divide, multiply,
   home, end, ctrl, shift, esc, ins, del, len }

@Injectable({providedIn: 'root'})
export class InputSystemService {

  public controls: boolean[] = Array(PressedKey.len).fill(false)
  public keyUpEvent = fromEvent(window, 'keyup').pipe(
    map((e: KeyboardEvent) => {
      if ((e.target as HTMLElement).nodeName === 'BODY') {
        this.handleKeys(e.code, false)
        e.preventDefault()
      }
      return this.keyMap.get(e.code)
    }))
  public keyDownEvent = fromEvent(window, 'keydown').pipe(
    map((e: KeyboardEvent) => {
      if ((e.target as HTMLElement).nodeName === 'BODY') {
        this.handleKeys(e.code, true)
        e.preventDefault()
      }
      return this.keyMap.get(e.code)
    }))

  private keyMap = new Map([
    ['ArrowUp', PressedKey.up],
    ['ArrowDown', PressedKey.down],
    ['ArrowLeft', PressedKey.left],
    ['ArrowRight', PressedKey.right],
    ['PageUp', PressedKey.pgUp],
    ['PageDown', PressedKey.pgDown],
    ['NumpadAdd', PressedKey.plus],
    ['NumpadSubtract', PressedKey.minus],
    ['NumpadDivide', PressedKey.divide],
    ['NumpadMultiply', PressedKey.multiply],
    ['Home', PressedKey.home],
    ['End', PressedKey.end],
    ['ControlLeft', PressedKey.ctrl],
    ['ControlRight', PressedKey.ctrl],
    ['ShiftLeft', PressedKey.shift],
    ['ShiftRight', PressedKey.shift],
    ['Escape', PressedKey.esc],
    ['Insert', PressedKey.ins],
    ['Delete', PressedKey.del]
  ])

  constructor() {
  }

  public handleKeys(k: string, value: boolean) {
    const key = this.keyMap.get(k)
    if (key != null) {
      this.controls[key] = value
    }
  }
}
