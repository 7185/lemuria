import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component
} from '@angular/core'
import type {OnInit} from '@angular/core'
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
export class UiBuilderZoneComponent implements OnInit {
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
  public selectedObject: any

  public constructor(
    private cdRef: ChangeDetectorRef,
    private engineSvc: EngineService,
    private objSvc: ObjectService
  ) {}

  trigger(event: MouseEvent, action: number) {
    if (event.button === 0) {
      this.objSvc.objectAction.next(action)
    }
    event.preventDefault()
  }

  public ngOnInit(): void {
    this.engineSvc.selectedObjectSub.asObservable().subscribe((object) => {
      this.selectedObject = object
      this.cdRef.detectChanges()
    })
  }
}
