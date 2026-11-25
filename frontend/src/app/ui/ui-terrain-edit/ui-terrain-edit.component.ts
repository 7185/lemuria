import {CdkDrag, CdkDragHandle} from '@angular/cdk/drag-drop'
import {Component, computed, inject} from '@angular/core'
import {FormsModule} from '@angular/forms'
import {MatIconButton} from '@angular/material/button'
import {MatCheckbox} from '@angular/material/checkbox'
import {MatFormField} from '@angular/material/form-field'
import {MatInput, MatLabel} from '@angular/material/input'
import {
  FaIconComponent,
  FaLayersComponent
} from '@fortawesome/angular-fontawesome'
import {
  faArrowRotateLeft,
  faArrowRotateRight,
  faArrowsUpDown,
  faClipboard,
  faClone,
  faSquare
} from '@fortawesome/free-solid-svg-icons'
import {provideTranslocoScope, TranslocoDirective} from '@jsverse/transloco'
import {BuildService} from '../../engine/build.service'
import {TerrainService} from '../../world/terrain.service'

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
    MatFormField
  ],
  providers: [
    provideTranslocoScope({scope: 'ui/ui-terrain-edit', alias: 'terrain-edit'})
  ],
  host: {
    '[class.d-none]': 'displayed()'
  },
  selector: 'app-ui-terrain-edit',
  templateUrl: './ui-terrain-edit.component.html',
  styleUrl: './ui-terrain-edit.component.scss'
})
export class UiTerrainEditComponent {
  protected readonly icon = {
    faArrowsUpDown,
    faArrowRotateLeft,
    faArrowRotateRight,
    faClipboard,
    faClone,
    faSquare
  }

  protected height = computed(() => this.buildSvc.selectedCell().height ?? 0)
  protected texture = computed(() => this.buildSvc.selectedCell().texture ?? 0)
  protected hole = computed(() => this.buildSvc.selectedCell().hole ?? false)
  protected displayed = computed(
    () => this.buildSvc.selectedCell().height === undefined
  )
  protected readonly buildSvc = inject(BuildService)
  protected readonly terrainSvc = inject(TerrainService)

  rotate(event: MouseEvent, delta: 1 | -1) {
    event.preventDefault()
    this.terrainSvc.rotateSelectedCell(delta)
  }

  copy(event: MouseEvent) {
    event.preventDefault()
    this.terrainSvc.copySelectedCell()
  }

  pasteElevation(event: MouseEvent) {
    event.preventDefault()
    this.terrainSvc.pasteElevation()
  }

  pasteTexture(event: MouseEvent) {
    event.preventDefault()
    this.terrainSvc.pasteTexture()
  }

  updateHeight(value: number | string | null) {
    const parsed = typeof value === 'number' ? value : Number(value)
    if (Number.isFinite(parsed)) {
      this.terrainSvc.setSelectedCellHeight(parsed)
    }
  }

  updateTexture(value: number | string | null) {
    const parsed = typeof value === 'number' ? value : Number(value)
    if (Number.isInteger(parsed) && parsed >= 0 && parsed <= 62) {
      this.terrainSvc.setSelectedCellTexture(parsed)
    }
  }

  updateHole(hole: boolean) {
    this.terrainSvc.setSelectedCellHole(hole)
  }
}
