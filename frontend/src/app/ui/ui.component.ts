import type {Signal} from '@angular/core'
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject
} from '@angular/core'
import {EngineComponent} from '../engine/engine.component'
import {UiChatZoneComponent} from './ui-chat-zone/ui-chat-zone.component'
import {UiToolbarComponent} from './ui-toolbar/ui-toolbar.component'
import {UiPropEditComponent} from './ui-prop-edit/ui-prop-edit.component'
import {UiTerrainEditComponent} from './ui-terrain-edit/ui-terrain-edit.component'
import {BuildService} from '../engine/build.service'

@Component({
  imports: [
    EngineComponent,
    UiToolbarComponent,
    UiChatZoneComponent,
    UiPropEditComponent,
    UiTerrainEditComponent
  ],
  selector: 'app-ui',
  styleUrl: './ui.component.scss',
  templateUrl: './ui.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UiComponent {
  loadPropEdit: Signal<boolean>
  loadTerrainEdit: Signal<boolean>

  private readonly buildSvc = inject(BuildService)

  constructor() {
    this.loadPropEdit = computed(
      () => this.buildSvc.selectedPropSignal()?.name != null
    )
    this.loadTerrainEdit = computed(
      () => this.buildSvc.selectedCellSignal()?.height != null
    )
  }
}
