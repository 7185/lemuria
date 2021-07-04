import {NgModule} from '@angular/core'
import {BrowserModule} from '@angular/platform-browser'
import {BrowserAnimationsModule} from '@angular/platform-browser/animations'
import {FormsModule, ReactiveFormsModule} from '@angular/forms'
import {HttpClientModule} from '@angular/common/http'
import {FaIconLibrary, FontAwesomeModule} from '@fortawesome/angular-fontawesome'
import {BsDropdownModule} from 'ngx-bootstrap/dropdown'
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
  faGlobe,
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
    BrowserAnimationsModule,
    BsDropdownModule.forRoot(),
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
      faGlobe,
      faKey,
      faLocationArrow,
      faSignOutAlt,
      faUser,
      faUsers,
      faVideo
    )
  }
}
