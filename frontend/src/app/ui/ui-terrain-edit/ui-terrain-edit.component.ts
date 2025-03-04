import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject
} from '@angular/core'
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
import {provideTranslocoScope, TranslocoDirective} from '@jsverse/transloco'

@Component({
  imports: [
    TranslocoDirective,
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
  providers: [
    provideTranslocoScope({scope: 'ui/ui-terrain-edit', alias: 'terrain-edit'})
  ],
  host: {
    '[class.d-none]': 'displayed()'
  },
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

  protected height = computed(() => this.buildSvc.selectedCell().height ?? 0)
  protected displayed = computed(
    () => this.buildSvc.selectedCell().height === undefined
  )
  protected readonly buildSvc = inject(BuildService)

  trigger(event: MouseEvent) {
    event.preventDefault()
  }
}
