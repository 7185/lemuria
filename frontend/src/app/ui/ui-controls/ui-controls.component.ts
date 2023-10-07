import {CommonModule} from '@angular/common'
import {InputSystemService, PressedKey} from '../../engine/inputsystem.service'
import type {OnInit} from '@angular/core'
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Output
} from '@angular/core'
import {Subject, takeUntil, take, timeout} from 'rxjs'

@Component({
  standalone: true,
  imports: [CommonModule],
  selector: 'app-ui-controls',
  templateUrl: './ui-controls.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
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

  private cancel: Subject<boolean>
  private oldKey: string

  constructor(
    private input: InputSystemService,
    private cdRef: ChangeDetectorRef
  ) {}

  setKey(key: number, pos: number) {
    if (this.cancel != null) {
      // Mapping already in progress, cancel it
      this.controlsKeymap[this.activeKey[0]][this.activeKey[1]] = this.oldKey
      this.activeKey = [null, null]
      this.cancel.next(true)
      this.cancel.complete()
    }
    this.activeKey = [key, pos]
    this.oldKey = this.controlsKeymap[key][pos]
    this.controlsKeymap[key][pos] = 'Press key...'
    this.cancel = new Subject()
    this.input.keyDownEvent
      .pipe(takeUntil(this.cancel), take(1), timeout(5000))
      .subscribe({
        next: (e: KeyboardEvent) => {
          this.controlsKeymap[key][pos] = e.code
          this.setKeymap()
          this.activeKey = [null, null]
          if (this.cancel != null) {
            this.cancel.complete()
            this.cancel = null
          }
          this.cdRef.detectChanges()
        },
        error: () => {
          this.controlsKeymap[key][pos] = this.oldKey
          this.activeKey = [null, null]
          if (this.cancel != null) {
            this.cancel.complete()
            this.cancel = null
          }
          this.cdRef.detectChanges()
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
    this.controlsKeymap.forEach((keys: string[], index) => {
      keys
        .filter((k) => k !== null)
        .forEach((k) => this.input.mapKey(k, this.controlsLabels[index][1]))
    })
  }

  close() {
    this.closeModal.emit()
  }

  ngOnInit() {
    this.getKeymap()
  }
}
