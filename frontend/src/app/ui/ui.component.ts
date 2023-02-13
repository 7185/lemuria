import {EngineComponent} from './../engine/engine.component'
import {UiBuilderZoneComponent} from './ui-builder-zone/ui-builder-zone.component'
import {UiChatZoneComponent} from './ui-chat-zone/ui-chat-zone.component'
import {UiToolbarComponent} from './ui-toolbar/ui-toolbar.component'
import {Component} from '@angular/core'
import type {OnInit} from '@angular/core'

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
  templateUrl: './ui.component.html'
})
export class UiComponent implements OnInit {
  public constructor() {}

  public ngOnInit(): void {}
}
