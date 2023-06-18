import {ChangeDetectionStrategy, Component} from '@angular/core'
import type {WritableSignal} from '@angular/core'
import {DatePipe} from '@angular/common'
import {FormsModule} from '@angular/forms'
import {NgxDraggableDomModule} from 'ngx-draggable-dom'
import {FontAwesomeModule} from '@fortawesome/angular-fontawesome'
import {ObjectService, ObjectAct} from '../../world/object.service'
import {BuildService} from '../../engine/build.service'
import {
  faArrowDown,
  faArrowLeft,
  faArrowRight,
  faArrowRotateLeft,
  faArrowRotateRight,
  faArrowUp,
  faBorderNone,
  faClone,
  faRoad,
  faRotate,
  faTrashCan
} from '@fortawesome/free-solid-svg-icons'

@Component({
  standalone: true,
  imports: [FormsModule, FontAwesomeModule, NgxDraggableDomModule, DatePipe],
  selector: 'app-ui-prop-edit',
  templateUrl: './ui-prop-edit.component.html',
  styleUrls: ['./ui-prop-edit.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UiPropEditComponent {
  public faArrowDown = faArrowDown
  public faArrowLeft = faArrowLeft
  public faArrowRight = faArrowRight
  public faArrowRotateLeft = faArrowRotateLeft
  public faArrowRotateRight = faArrowRotateRight
  public faArrowUp = faArrowUp
  public faBorderNone = faBorderNone
  public faClone = faClone
  public faRoad = faRoad
  public faRotate = faRotate
  public faTrashCan = faTrashCan

  public objectAct = ObjectAct
  public selectedObject: WritableSignal<{
    name?: string
    desc?: string
    act?: string
    date?: number
  }>

  public constructor(
    private buildSvc: BuildService,
    private objSvc: ObjectService
  ) {
    this.selectedObject = this.buildSvc.selectedObjectSignal
  }

  trigger(event: MouseEvent, action: number) {
    if (event.button === 0) {
      this.objSvc.objectAction.next(action)
    }
    event.preventDefault()
  }
}
