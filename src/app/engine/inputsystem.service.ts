import {Injectable} from '@angular/core'
import {fromEvent} from 'rxjs'
import {map} from 'rxjs/operators'

export const enum PressedKey { up = 0, right, down, left, pgUp, pgDown, plus, minus, ctrl, shift, esc, ins, del }

@Injectable({providedIn: 'root'})
export class InputSystemService {

  public controls: boolean[] = Array(9).fill(false)
  public keyUpEvent = fromEvent(window, 'keyup').pipe(
    map((e: KeyboardEvent) => {
      if ((e.target as HTMLElement).nodeName === 'BODY') {
        this.handleKeys(e.code, false)
        e.preventDefault()
      }
    }))
  public keyDownEvent = fromEvent(window, 'keydown').pipe(
    map((e: KeyboardEvent) => {
      if ((e.target as HTMLElement).nodeName === 'BODY') {
        this.handleKeys(e.code, true)
        e.preventDefault()
      }
    }))

  constructor() {
  }

  public handleKeys(k: string, value: boolean) {
    switch (k) {
      case 'ArrowUp': {
        this.controls[PressedKey.up] = value
        break
      }
      case 'ArrowDown': {
        this.controls[PressedKey.down] = value
        break
      }
      case 'ArrowLeft': {
        this.controls[PressedKey.left] = value
        break
      }
      case 'ArrowRight': {
        this.controls[PressedKey.right] = value
        break
      }
      case 'PageUp': {
        this.controls[PressedKey.pgUp] = value
        break
      }
      case 'PageDown': {
        this.controls[PressedKey.pgDown] = value
        break
      }
      case 'NumpadAdd': {
        this.controls[PressedKey.plus] = value
        break
      }
      case 'NumpadSubtract': {
        this.controls[PressedKey.minus] = value
        break
      }
      case 'ControlLeft': {
        this.controls[PressedKey.ctrl] = value
        break
      }
      case 'ControlRight': {
        this.controls[PressedKey.ctrl] = value
        break
      }
      case 'ShiftLeft': {
        this.controls[PressedKey.shift] = value
        break
      }
      case 'ShiftRight': {
        this.controls[PressedKey.shift] = value
        break
      }
      case 'Escape': {
        this.controls[PressedKey.esc] = value
        break
      }
      case 'Insert': {
        this.controls[PressedKey.ins] = value
        break
      }
      case 'Delete': {
        this.controls[PressedKey.del] = value
        break
      }
      default: {
        break
      }
    }
  }
}
