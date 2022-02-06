import {InputSystemService, PressedKey} from './../../engine/inputsystem.service'
import type {OnInit} from '@angular/core'
import {Component, EventEmitter, Output} from '@angular/core'
import type {Subscription} from 'rxjs'
import {take, timeout} from 'rxjs'

@Component({
  selector: 'app-ui-controls',
  templateUrl: './ui-controls.component.html'
})
export class UiControlsComponent implements OnInit {

  @Output() closeModal = new EventEmitter()

  public controlsLabels: [string, PressedKey][] = [
    ['Move Forward', PressedKey.moveFwd],
    ['Move Backward', PressedKey.moveBck],
    ['Turn Left', PressedKey.turnLft],
    ['Turn Right', PressedKey.turnRgt],
    ['Move Left', PressedKey.moveLft],
    ['Move Right', PressedKey.moveRgt],
    ['Sidestep', PressedKey.side],
    ['Run', PressedKey.run],
    ['Jump', PressedKey.jmp],
    ['Move Up (Fly)', PressedKey.moveUp],
    ['Move Down', PressedKey.moveDwn],
    ['Look Up', PressedKey.lookUp],
    ['Look Down', PressedKey.lookDwn],
    ['Pass Through', PressedKey.clip]
  ]

  public controlsKeymap = Array(this.controlsLabels.length).fill([null, null])

  public activeKey = [null, null]

  private waitForKey: Subscription

  constructor(private input: InputSystemService) {}

  setKey(key: number, pos: number) {
    this.activeKey = [key, pos]
    const oldKey = this.controlsKeymap[key][pos]
    this.controlsKeymap[key][pos] = 'Press key...'
    if (this.waitForKey) {
      this.waitForKey.unsubscribe()
    }
    this.waitForKey = this.input.keyDownEvent.pipe(
      take(1),
      timeout(5000)
    ).subscribe({
      next: (e: KeyboardEvent) => this.controlsKeymap[key][pos] = e.code,
      error: () => this.controlsKeymap[key][pos] = oldKey,
      complete: () => {
        this.activeKey = [null, null]
        this.setKeymap()
      }
    })
  }

  setDefault() {
    this.input.setDefault()
    this.getKeymap()
  }

  getKeymap() {
    this.controlsKeymap = []
    for (const l of this.controlsLabels) {
      const newKeys = [null, null]
      let i = 0
      for (const k of this.input.getKeyMap()) {
        // only 2 values allowed
        if (k[1] === l[1] && i < 2) {
          newKeys[i] = k[0]
          i++
        }
      }
      this.controlsKeymap.push(newKeys)
    }
  }

  setKeymap() {
    this.input.clearKeys()
    this.controlsKeymap.forEach((keys, index) => {
      for (const k of keys) {
        if (k != null) {
          this.input.mapKey(k, this.controlsLabels[index][1])
        }
      }
    })
  }

  close() {
    this.closeModal.emit()
  }

  ngOnInit() {
    this.getKeymap()
  }
}
