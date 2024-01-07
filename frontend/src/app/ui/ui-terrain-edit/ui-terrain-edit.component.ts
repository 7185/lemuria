import {ChangeDetectionStrategy, Component, effect, inject} from '@angular/core'
import type {WritableSignal} from '@angular/core'
import {DecimalPipe} from '@angular/common'
import {FormsModule} from '@angular/forms'
import {CdkDrag, CdkDragHandle} from '@angular/cdk/drag-drop'
import {MatButtonModule} from '@angular/material/button'
import {MatCheckboxModule} from '@angular/material/checkbox'
import {MatInputModule} from '@angular/material/input'
import {MatFormFieldModule} from '@angular/material/form-field'
import {FontAwesomeModule} from '@fortawesome/angular-fontawesome'
import {BuildService} from '../../engine/build.service'
import {
  faArrowsUpDown,
  faArrowRotateLeft,
  faArrowRotateRight,
  faClipboard,
  faClone,
  faSquare
} from '@fortawesome/free-solid-svg-icons'

@Component({
  standalone: true,
  imports: [
    FormsModule,
    FontAwesomeModule,
    CdkDrag,
    CdkDragHandle,
    MatButtonModule,
    MatCheckboxModule,
    MatInputModule,
    MatFormFieldModule,
    DecimalPipe
  ],
  selector: 'app-ui-terrain-edit',
  templateUrl: './ui-terrain-edit.component.html',
  styleUrl: './ui-terrain-edit.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UiTerrainEditComponent {
  public faArrowsUpDown = faArrowsUpDown
  public faArrowRotateLeft = faArrowRotateLeft
  public faArrowRotateRight = faArrowRotateRight
  public faClipboard = faClipboard
  public faClone = faClone
  public faSquare = faSquare

  public selectedCell: WritableSignal<{
    height?: number
    texture?: number
    hole?: boolean
  }>
  public height = 0
  private buildSvc = inject(BuildService)

  constructor() {
    this.selectedCell = this.buildSvc.selectedCellSignal
    effect(() => {
      this.height = this.selectedCell().height
    })
  }

  public trigger(event: MouseEvent) {
    event.preventDefault()
  }
}
