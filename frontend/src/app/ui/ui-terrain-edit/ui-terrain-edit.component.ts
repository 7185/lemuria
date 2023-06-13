import {ChangeDetectionStrategy, Component, effect} from '@angular/core'
import type {WritableSignal} from '@angular/core'
import {DecimalPipe} from '@angular/common'
import {FormsModule} from '@angular/forms'
import {NgxDraggableDomModule} from 'ngx-draggable-dom'
import {FontAwesomeModule} from '@fortawesome/angular-fontawesome'
import {EngineService} from '../../engine/engine.service'
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
  imports: [FormsModule, FontAwesomeModule, NgxDraggableDomModule, DecimalPipe],
  selector: 'app-ui-terrain-edit',
  templateUrl: './ui-terrain-edit.component.html',
  styleUrls: ['./ui-terrain-edit.component.scss'],
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

  constructor(private engineSvc: EngineService) {
    this.selectedCell = this.engineSvc.selectedCellSignal
    effect(() => {
      this.height = this.selectedCell().height
    })
  }

  public trigger(event) {
    event.preventDefault()
  }
}
