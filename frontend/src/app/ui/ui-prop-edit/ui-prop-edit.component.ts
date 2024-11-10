import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject
} from '@angular/core'
import type {WritableSignal} from '@angular/core'
import {DatePipe} from '@angular/common'
import {FormsModule} from '@angular/forms'
import {CdkDrag, CdkDragHandle} from '@angular/cdk/drag-drop'
import {MatIconButton} from '@angular/material/button'
import {MatInput, MatLabel} from '@angular/material/input'
import {MatFormField} from '@angular/material/form-field'
import {
  FaIconComponent,
  FaLayersComponent,
  FaLayersTextComponent
} from '@fortawesome/angular-fontawesome'
import type {Group} from 'three'
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
  imports: [
    FormsModule,
    FaIconComponent,
    FaLayersComponent,
    FaLayersTextComponent,
    CdkDragHandle,
    MatIconButton,
    MatInput,
    MatLabel,
    MatFormField,
    DatePipe
  ],
  host: {
    '[class.d-none]': 'displayed()'
  },
  hostDirectives: [CdkDrag],
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

  protected selectedProp: WritableSignal<Group>
  protected displayed = computed(() => this.selectedProp() === null)

  private readonly buildSvc = inject(BuildService)
  private readonly propSvc = inject(PropService)

  constructor() {
    this.selectedProp = this.buildSvc.selectedPropSignal
  }

  updateName(name: string) {
    if (this.selectedProp() == null) {
      return
    }
    this.selectedProp().name = name
  }

  trigger(event: MouseEvent, control: PropCtl) {
    if (event.button === 0) {
      this.propSvc.propControl.next(control)
    }
    event.preventDefault()
  }
}
