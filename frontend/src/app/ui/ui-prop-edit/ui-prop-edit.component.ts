import {ChangeDetectionStrategy, Component, inject} from '@angular/core'
import type {WritableSignal} from '@angular/core'
import {DatePipe} from '@angular/common'
import {FormsModule} from '@angular/forms'
import {CdkDrag, CdkDragHandle} from '@angular/cdk/drag-drop'
import {MatButtonModule} from '@angular/material/button'
import {MatInputModule} from '@angular/material/input'
import {MatFormFieldModule} from '@angular/material/form-field'
import {FontAwesomeModule} from '@fortawesome/angular-fontawesome'
import {PropService} from '../../world/prop.service'
import type {PropCtl} from '../../world/prop.service'
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
  imports: [
    FormsModule,
    FontAwesomeModule,
    CdkDrag,
    CdkDragHandle,
    MatButtonModule,
    MatInputModule,
    MatFormFieldModule,
    DatePipe
  ],
  selector: 'app-ui-prop-edit',
  templateUrl: './ui-prop-edit.component.html',
  styleUrl: './ui-prop-edit.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UiPropEditComponent {
  faArrowDown = faArrowDown
  faArrowLeft = faArrowLeft
  faArrowRight = faArrowRight
  faArrowRotateLeft = faArrowRotateLeft
  faArrowRotateRight = faArrowRotateRight
  faArrowUp = faArrowUp
  faBorderNone = faBorderNone
  faClone = faClone
  faRoad = faRoad
  faRotate = faRotate
  faTrashCan = faTrashCan

  selectedProp: WritableSignal<{
    name?: string
    desc?: string
    act?: string
    date?: number
  }>

  private readonly buildSvc = inject(BuildService)
  private readonly propSvc = inject(PropService)

  constructor() {
    this.selectedProp = this.buildSvc.selectedPropSignal
  }

  trigger(event: MouseEvent, control: PropCtl) {
    if (event.button === 0) {
      this.propSvc.propControl.next(control)
    }
    event.preventDefault()
  }
}
