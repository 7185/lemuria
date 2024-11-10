import {MatButton} from '@angular/material/button'
import {MatDialogContent, MatDialogTitle} from '@angular/material/dialog'
import type {PressedKey} from '../../engine/inputsystem.service'
import {InputSystemService} from '../../engine/inputsystem.service'
import type {OnInit} from '@angular/core'
import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core'
import {Subject, take, takeUntil, timeout} from 'rxjs'

@Component({
  imports: [MatButton, MatDialogContent, MatDialogTitle],
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

  protected controlsKeymap: [string | null, string | null][] = Array(
    this.controlsLabels.length
  ).fill([null, null])
  protected activeKey = signal<[number | null, number | null]>([null, null])

  private readonly inputSysSvc = inject(InputSystemService)
  private cancel: Subject<void> | null = null
  private oldKey: string | null = 'nop'

  setKey(key: number, pos: number): void {
    if (this.cancel != null) {
      // Mapping already in progress, cancel it
      this.controlsKeymap[this.activeKey()[0]!][this.activeKey()[1]!] =
        this.oldKey
      this.activeKey.set([null, null])
      this.cancel.next()
      this.cancel.complete()
    }
    this.activeKey.set([key, pos])
    this.oldKey = this.controlsKeymap[key][pos]
    this.controlsKeymap[key][pos] = 'Press key...'
    this.cancel = new Subject()
    this.inputSysSvc.keyDownEvent
      .pipe(take(1), timeout(5000), takeUntil(this.cancel))
      .subscribe({
        next: (e: KeyboardEvent) => {
          this.controlsKeymap[key][pos] = e.code
          this.setKeymap()
          this.activeKey.set([null, null])
          if (this.cancel != null) {
            this.cancel.complete()
            this.cancel = null
          }
        },
        error: () => {
          this.controlsKeymap[key][pos] = this.oldKey
          this.activeKey.set([null, null])
          if (this.cancel != null) {
            this.cancel.complete()
            this.cancel = null
          }
        }
      })
  }

  setDefault(): void {
    this.inputSysSvc.setDefault()
    this.getKeymap()
  }

  getKeymap(): void {
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

  setKeymap(): void {
    this.inputSysSvc.clearKeys()
    this.controlsKeymap.forEach(
      (keys: [string | null, string | null], index) => {
        keys
          .filter((k) => k !== null)
          .forEach((k) =>
            this.inputSysSvc.mapKey(k, this.controlsLabels[index][1])
          )
      }
    )
  }

  ngOnInit(): void {
    this.getKeymap()
  }
}
