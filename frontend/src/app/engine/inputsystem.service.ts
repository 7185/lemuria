import {inject, Injectable} from '@angular/core'
import {fromEvent} from 'rxjs'
import {filter, tap} from 'rxjs/operators'
import {SettingsService} from '../settings/settings.service'

const pressedKeys = [
  'nop',
  'moveFwd',
  'moveBck',
  'turnLft',
  'turnRgt',
  'moveLft',
  'moveRgt',
  'moveUp',
  'moveDwn',
  'lookUp',
  'lookDwn',
  'run',
  'clip',
  'side',
  'jmp',
  'cpy',
  'del',
  'esc'
] as const
export type PressedKey = (typeof pressedKeys)[number]

@Injectable({providedIn: 'root'})
export class InputSystemService {
  controls: Record<PressedKey, boolean> = pressedKeys.reduce(
    (acc, value) => {
      return {...acc, [value]: false}
    },
    {} as Record<PressedKey, boolean>
  )

  keyUpEvent = fromEvent<KeyboardEvent>(window, 'keyup').pipe(
    filter(
      (e: KeyboardEvent) =>
        ['INPUT', 'TEXTAREA'].indexOf((e.target as HTMLElement).nodeName) === -1
    ),
    tap((e: KeyboardEvent) => {
      this.handleKeys(e.code, false)
      e.preventDefault()
    })
  )

  keyDownEvent = fromEvent<KeyboardEvent>(window, 'keydown').pipe(
    filter(
      (e: KeyboardEvent) =>
        ['INPUT', 'TEXTAREA'].indexOf((e.target as HTMLElement).nodeName) === -1
    ),
    tap((e: KeyboardEvent) => {
      this.handleKeys(e.code, true)
      e.preventDefault()
    })
  )

  private readonly defaultKeymap = new Map<string, PressedKey>([
    ['ArrowUp', 'moveFwd'],
    ['KeyW', 'moveFwd'],
    ['ArrowDown', 'moveBck'],
    ['KeyS', 'moveBck'],
    ['ArrowLeft', 'turnLft'],
    ['KeyQ', 'turnLft'],
    ['ArrowRight', 'turnRgt'],
    ['KeyE', 'turnRgt'],
    ['KeyA', 'moveLft'],
    ['KeyD', 'moveRgt'],
    ['PageUp', 'lookUp'],
    ['PageDown', 'lookDwn'],
    ['NumpadAdd', 'moveUp'],
    ['NumpadSubtract', 'moveDwn'],
    //['NumpadDivide', 'divide'],
    //['NumpadMultiply', 'multiply'],
    //['Home', 'home'],
    //['End', 'end'],
    ['ShiftLeft', 'clip'],
    ['ShiftRight', 'clip'],
    ['ControlLeft', 'run'],
    ['ControlRight', 'run'],
    ['Numpad0', 'jmp'],
    ['Space', 'jmp'],
    ['Escape', 'esc'],
    ['Insert', 'cpy'],
    ['Delete', 'del']
  ])

  private keyMap: Map<string, PressedKey>
  private readonly settings = inject(SettingsService)

  constructor() {
    this.keyMap = new Map(this.settings.get('keymap') ?? this.defaultKeymap)
  }

  clearKeys() {
    this.keyMap.clear()
    this.saveKeyMap()
  }

  getKeyMap() {
    return this.keyMap
  }

  getKey(k: string) {
    return this.keyMap.get(k)
  }

  setDefault() {
    this.keyMap = new Map(this.defaultKeymap)
    this.saveKeyMap()
  }

  mapKey(k: string, value: PressedKey) {
    this.keyMap.set(k, value)
    this.saveKeyMap()
  }

  handleKeys(k: string, value: boolean) {
    const key = this.keyMap.get(k)
    if (key != null) {
      this.controls[key] = value
    }
  }

  private saveKeyMap() {
    this.settings.set('keymap', Array.from(this.keyMap.entries()))
  }
}
