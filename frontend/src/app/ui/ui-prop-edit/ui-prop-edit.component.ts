import {CdkDrag, CdkDragHandle} from '@angular/cdk/drag-drop'
import {DatePipe} from '@angular/common'
import {Component, computed, inject} from '@angular/core'
import {FormsModule} from '@angular/forms'
import {MatIconButton} from '@angular/material/button'
import {MatFormField} from '@angular/material/form-field'
import {MatInput, MatLabel} from '@angular/material/input'
import {
  FaIconComponent,
  FaLayersComponent,
  FaLayersTextComponent
} from '@fortawesome/angular-fontawesome'
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
import {provideTranslocoScope, TranslocoDirective} from '@jsverse/transloco'
import type {PropCtl} from '../../world/prop.service'
import {BuildService} from '../../engine/build.service'
import {PropService} from '../../world/prop.service'

@Component({
  imports: [
    TranslocoDirective,
    FormsModule,
    FaIconComponent,
    FaLayersComponent,
    FaLayersTextComponent,
    CdkDrag,
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
  providers: [
    provideTranslocoScope({scope: 'ui/ui-prop-edit', alias: 'prop-edit'})
  ],
  selector: 'app-ui-prop-edit',
  templateUrl: './ui-prop-edit.component.html',
  styleUrl: './ui-prop-edit.component.scss'
})
export class UiPropEditComponent {
  protected readonly icon = {
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
  }

  protected displayed = computed(() => this.buildSvc.selectedProp() === null)

  protected readonly buildSvc = inject(BuildService)
  private readonly propSvc = inject(PropService)

  updateName(name: string) {
    if (this.buildSvc.selectedProp() == null) {
      return
    }
    this.buildSvc.selectedProp().name = name
  }

  trigger(event: MouseEvent, control: PropCtl) {
    if (event.button === 0) {
      this.propSvc.propControl.next(control)
    }
    event.preventDefault()
  }
}
