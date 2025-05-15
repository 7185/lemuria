import {MatButton} from '@angular/material/button'
import {
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle
} from '@angular/material/dialog'
import type {PressedKey} from '../../engine/inputsystem.service'
import {InputSystemService} from '../../engine/inputsystem.service'
import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core'
import {Subject, take, takeUntil, timeout} from 'rxjs'
import {
  provideTranslocoScope,
  TranslocoDirective,
  TranslocoService
} from '@jsverse/transloco'

@Component({
  imports: [TranslocoDirective, MatButton, MatDialogContent, MatDialogTitle],
  providers: [
    provideTranslocoScope({scope: 'ui/ui-controls', alias: 'controls'})
  ],
  selector: 'app-ui-controls',
  templateUrl: './ui-controls.component.html',
  styleUrl: './ui-controls.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UiControlsComponent {
  protected controlsKeys: PressedKey[] = [
    'moveFwd',
    'moveBck',
    'turnLft',
    'turnRgt',
    'moveLft',
    'moveRgt',
    'side',
    'run',
    'jmp',
    'moveUp',
    'moveDwn',
    'lookUp',
    'lookDwn',
    'clip'
  ]
  protected controlsKeymap: [string | null, string | null][] = Array(
    this.controlsKeys.length
  ).fill([null, null])
  protected activeKey = signal<[number | null, number | null]>([null, null])

  private readonly inputSysSvc = inject(InputSystemService)
  private readonly translocoSvc = inject(TranslocoService)
  private cancel: Subject<void> | null = null
  private oldKey: string | null = 'nop'
  private dialogRef = inject(MatDialogRef<UiControlsComponent>)
  constructor() {
    // Disable Escape but allow backdrop click to close the dialog
    this.dialogRef.disableClose = true
    this.dialogRef.backdropClick().subscribe(() => {
      this.dialogRef.close()
    })
    this.getKeymap()
  }

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
    this.controlsKeymap[key][pos] =
      `${this.translocoSvc.translate('controls.pressKey')}...`
    this.cancel = new Subject()
    this.inputSysSvc.keyDownEvent
      .pipe(take(1), timeout(5000), takeUntil(this.cancel))
      .subscribe({
        next: (e: KeyboardEvent) => {
          this.controlsKeymap[key][pos] = e.code !== 'Escape' ? e.code : null
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
    for (const key of this.controlsKeys) {
      const newKeys: [string | null, string | null] = [null, null]
      let i = 0
      for (const k of this.inputSysSvc.getKeyMap()) {
        // only 2 values allowed
        if (k[1] === key && i < 2) {
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
          .forEach((k) => this.inputSysSvc.mapKey(k, this.controlsKeys[index]))
      }
    )
  }
}
