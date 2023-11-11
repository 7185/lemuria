import {NgClass} from '@angular/common'
import {MatButtonModule} from '@angular/material/button'
import {MatDialogModule} from '@angular/material/dialog'
import {InputSystemService, PressedKey} from '../../engine/inputsystem.service'
import type {OnInit} from '@angular/core'
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject
} from '@angular/core'
import {Subject, takeUntil, take, timeout} from 'rxjs'

@Component({
  standalone: true,
  imports: [NgClass, MatButtonModule, MatDialogModule],
  selector: 'app-ui-controls',
  templateUrl: './ui-controls.component.html',
  styleUrls: ['./ui-controls.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UiControlsComponent implements OnInit {
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

  private inputSysSvc = inject(InputSystemService)
  private cdRef = inject(ChangeDetectorRef)
  private cancel: Subject<boolean>
  private oldKey: string

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
    this.inputSysSvc.keyDownEvent
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
    this.inputSysSvc.setDefault()
    this.getKeymap()
  }

  getKeymap() {
    this.controlsKeymap = []
    for (const l of this.controlsLabels) {
      const newKeys = [null, null]
      let i = 0
      for (const k of this.inputSysSvc.getKeyMap()) {
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
    this.inputSysSvc.clearKeys()
    this.controlsKeymap.forEach((keys: string[], index) => {
      keys
        .filter((k) => k !== null)
        .forEach((k) =>
          this.inputSysSvc.mapKey(k, this.controlsLabels[index][1])
        )
    })
  }

  ngOnInit() {
    this.getKeymap()
  }
}
