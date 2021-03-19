import {NgModule} from '@angular/core'
import {BrowserModule} from '@angular/platform-browser'
import {FormsModule, ReactiveFormsModule} from '@angular/forms'
import {HttpClientModule} from '@angular/common/http'
import {FaIconLibrary, FontAwesomeModule} from '@fortawesome/angular-fontawesome'
import {VirtualScrollerModule} from 'ngx-virtual-scroller'
import {AppComponent} from './app.component'
import {LogoComponent} from './logo/logo.component'
import {EngineComponent} from './engine/engine.component'
import {UiToolbarComponent} from './ui/ui-toolbar/ui-toolbar.component'
import {UiChatZoneComponent} from './ui/ui-chat-zone/ui-chat-zone.component'
import {AppRoutingModule, routingComponents} from './app-routing.module'

import {
  faComments,
  faCircleNotch,
  faEye,
  faKey,
  faLocationArrow,
  faSignOutAlt,
  faUser,
  faUsers,
  faVideo
} from '@fortawesome/free-solid-svg-icons'

@NgModule({
  declarations: [
    AppComponent,
    routingComponents,
    LogoComponent,
    EngineComponent,
    UiToolbarComponent,
    UiChatZoneComponent
  ],
  imports: [
    BrowserModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    FontAwesomeModule,
    VirtualScrollerModule,
    AppRoutingModule
  ],
  providers: [],
  bootstrap: [
    AppComponent
  ]
})
export class AppModule {
  constructor(private iconLibrary: FaIconLibrary) {
    iconLibrary.addIcons(
      faComments,
      faCircleNotch,
      faEye,
      faKey,
      faLocationArrow,
      faSignOutAlt,
      faUser,
      faUsers,
      faVideo
    )
  }
}
