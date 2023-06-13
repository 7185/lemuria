import {EngineComponent} from '../engine/engine.component'
import {UiChatZoneComponent} from './ui-chat-zone/ui-chat-zone.component'
import {UiToolbarComponent} from './ui-toolbar/ui-toolbar.component'
import {UiPropEditComponent} from './ui-prop-edit/ui-prop-edit.component'
import {UiTerrainEditComponent} from './ui-terrain-edit/ui-terrain-edit.component'
import {ChangeDetectionStrategy, Component} from '@angular/core'

@Component({
  standalone: true,
  imports: [
    EngineComponent,
    UiToolbarComponent,
    UiChatZoneComponent,
    UiPropEditComponent,
    UiTerrainEditComponent
  ],
  selector: 'app-ui',
  styleUrls: ['./ui.component.scss'],
  templateUrl: './ui.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UiComponent {}
