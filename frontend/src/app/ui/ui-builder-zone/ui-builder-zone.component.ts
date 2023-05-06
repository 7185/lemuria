import {ChangeDetectionStrategy, Component} from '@angular/core'
import type {WritableSignal} from '@angular/core'
import {DatePipe} from '@angular/common'
import {FormsModule} from '@angular/forms'
import {FontAwesomeModule} from '@fortawesome/angular-fontawesome'
import {ObjectService, ObjectAct} from '../../world/object.service'
import {EngineService} from '../../engine/engine.service'
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
  imports: [FormsModule, FontAwesomeModule, DatePipe],
  selector: 'app-ui-builder-zone',
  templateUrl: './ui-builder-zone.component.html',
  styleUrls: ['./ui-builder-zone.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UiBuilderZoneComponent {
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
    private engineSvc: EngineService,
    private objSvc: ObjectService
  ) {
    this.selectedObject = this.engineSvc.selectedObjectSignal
  }

  trigger(event: MouseEvent, action: number) {
    if (event.button === 0) {
      this.objSvc.objectAction.next(action)
    }
    event.preventDefault()
  }
}
