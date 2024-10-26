import {ChangeDetectionStrategy, Component, effect, inject} from '@angular/core'
import type {WritableSignal} from '@angular/core'
import {DecimalPipe} from '@angular/common'
import {FormsModule} from '@angular/forms'
import {CdkDrag, CdkDragHandle} from '@angular/cdk/drag-drop'
import {MatIconButton} from '@angular/material/button'
import {MatCheckbox} from '@angular/material/checkbox'
import {MatInput, MatLabel} from '@angular/material/input'
import {MatFormField} from '@angular/material/form-field'
import {
  FaIconComponent,
  FaLayersComponent
} from '@fortawesome/angular-fontawesome'
import {BuildService} from '../../engine/build.service'
import {
  faArrowRotateLeft,
  faArrowRotateRight,
  faArrowsUpDown,
  faClipboard,
  faClone,
  faSquare
} from '@fortawesome/free-solid-svg-icons'

@Component({
  standalone: true,
  imports: [
    FormsModule,
    FaIconComponent,
    FaLayersComponent,
    CdkDrag,
    CdkDragHandle,
    MatIconButton,
    MatCheckbox,
    MatInput,
    MatLabel,
    MatFormField,
    DecimalPipe
  ],
  selector: 'app-ui-terrain-edit',
  templateUrl: './ui-terrain-edit.component.html',
  styleUrl: './ui-terrain-edit.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UiTerrainEditComponent {
  faArrowsUpDown = faArrowsUpDown
  faArrowRotateLeft = faArrowRotateLeft
  faArrowRotateRight = faArrowRotateRight
  faClipboard = faClipboard
  faClone = faClone
  faSquare = faSquare

  selectedCell: WritableSignal<{
    height?: number
    texture?: number
    hole?: boolean
  }>
  height = 0
  private readonly buildSvc = inject(BuildService)

  constructor() {
    this.selectedCell = this.buildSvc.selectedCellSignal
    effect(() => {
      this.height = this.selectedCell().height
    })
  }

  trigger(event: MouseEvent) {
    event.preventDefault()
  }
}
