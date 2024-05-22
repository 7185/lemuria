import {NgClass} from '@angular/common'
import {MatButtonModule} from '@angular/material/button'
import {MatDialogModule} from '@angular/material/dialog'
import type {PressedKey} from '../../engine/inputsystem.service'
import {InputSystemService} from '../../engine/inputsystem.service'
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
  styleUrl: './ui-controls.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UiControlsComponent implements OnInit {
  controlsLabels: [string, PressedKey][] = [
    ['Move Forward', 'moveFwd'],
    ['Move Backward', 'moveBck'],
    ['Turn Left', 'turnLft'],
    ['Turn Right', 'turnRgt'],
    ['Move Left', 'moveLft'],
    ['Move Right', 'moveRgt'],
    ['Sidestep', 'side'],
    ['Run', 'run'],
    ['Jump', 'jmp'],
    ['Move Up (Fly)', 'moveUp'],
    ['Move Down', 'moveDwn'],
    ['Look Up', 'lookUp'],
    ['Look Down', 'lookDwn'],
    ['Pass Through', 'clip']
  ]

  controlsKeymap = Array(this.controlsLabels.length).fill([null, null])
  activeKey: [number | null, number | null] = [null, null]

  private readonly inputSysSvc = inject(InputSystemService)
  private readonly cdRef = inject(ChangeDetectorRef)
  private cancel: Subject<boolean> | null = null
  private oldKey = 'nop'

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
      const newKeys: [string | null, string | null] = [null, null]
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
