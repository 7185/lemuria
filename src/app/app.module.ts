import {NgModule} from '@angular/core'
import {BrowserModule} from '@angular/platform-browser'
import {FormsModule} from '@angular/forms'
import {HttpClientModule} from '@angular/common/http'
import {FaIconLibrary, FontAwesomeModule} from '@fortawesome/angular-fontawesome'
import {VirtualScrollerModule} from 'ngx-virtual-scroller'
import {AppComponent} from './app.component'
import {EngineComponent} from './engine/engine.component'
import {UiToolbarComponent} from './ui/ui-toolbar/ui-toolbar.component'
import {UiChatZoneComponent} from './ui/ui-chat-zone/ui-chat-zone.component'
import {UiComponent} from './ui/ui.component'

import {
  faEye,
  faUser,
  faVideo
} from '@fortawesome/free-solid-svg-icons'

@NgModule({
  declarations: [
    AppComponent,
    EngineComponent,
    UiComponent,
    UiToolbarComponent,
    UiChatZoneComponent
  ],
  imports: [
    BrowserModule,
    FormsModule,
    HttpClientModule,
    FontAwesomeModule,
    VirtualScrollerModule
  ],
  providers: [],
  bootstrap: [
    AppComponent
  ]
})
export class AppModule {
  constructor(private iconLibrary: FaIconLibrary) {
    iconLibrary.addIcons(
      faEye,
      faUser,
      faVideo
    )
  }
}
