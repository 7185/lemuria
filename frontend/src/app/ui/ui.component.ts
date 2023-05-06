import {EngineComponent} from '../engine/engine.component'
import {UiBuilderZoneComponent} from './ui-builder-zone/ui-builder-zone.component'
import {UiChatZoneComponent} from './ui-chat-zone/ui-chat-zone.component'
import {UiToolbarComponent} from './ui-toolbar/ui-toolbar.component'
import {ChangeDetectionStrategy, Component} from '@angular/core'

@Component({
  standalone: true,
  imports: [
    EngineComponent,
    UiToolbarComponent,
    UiChatZoneComponent,
    UiBuilderZoneComponent
  ],
  selector: 'app-ui',
  styleUrls: ['./ui.component.scss'],
  templateUrl: './ui.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UiComponent {}
