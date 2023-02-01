import {NgModule} from '@angular/core'
import {APP_BASE_HREF} from '@angular/common'
import {BrowserModule} from '@angular/platform-browser'
import {BrowserAnimationsModule} from '@angular/platform-browser/animations'
import {FormsModule, ReactiveFormsModule} from '@angular/forms'
import {HttpClientModule, HTTP_INTERCEPTORS} from '@angular/common/http'
import {
  FaIconLibrary,
  FontAwesomeModule
} from '@fortawesome/angular-fontawesome'
import {BsDropdownModule} from 'ngx-bootstrap/dropdown'
import {BsModalService} from 'ngx-bootstrap/modal'
import {VirtualScrollerModule} from '@floogulinc/ngx-virtual-scroller'
import {AppComponent} from './app.component'
import {LogoComponent} from './logo/logo.component'
import {EngineComponent} from './engine/engine.component'
import {UiToolbarComponent} from './ui/ui-toolbar/ui-toolbar.component'
import {UiChatZoneComponent} from './ui/ui-chat-zone/ui-chat-zone.component'
import {UiBuilderZoneComponent} from './ui/ui-builder-zone/ui-builder-zone.component'
import {UiControlsComponent} from './ui/ui-controls/ui-controls.component'
import {UiSettingsComponent} from './ui/ui-settings/ui-settings.component'
import {AppRoutingModule, routingComponents} from './app-routing.module'
import {JwtInterceptor} from './network/http.interceptor.service'
import {LinkifyPipe} from './utils/linkify.pipe'

import {
  faArrowDown,
  faArrowLeft,
  faArrowUp,
  faArrowRight,
  faArrowRotateLeft,
  faArrowRotateRight,
  faBolt,
  faBorderNone,
  faCheck,
  faCircleNotch,
  faClone,
  faCog,
  faComments,
  faEye,
  faGlobe,
  faKey,
  faKeyboard,
  faLocationArrow,
  faPerson,
  faRightFromBracket,
  faRoad,
  faTrashCan,
  faRotate,
  faUser,
  faUsers,
  faVideo
} from '@fortawesome/free-solid-svg-icons'

@NgModule({
  declarations: [
    LinkifyPipe,
    AppComponent,
    routingComponents,
    LogoComponent,
    EngineComponent,
    UiToolbarComponent,
    UiChatZoneComponent,
    UiBuilderZoneComponent,
    UiControlsComponent,
    UiSettingsComponent
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
  providers: [
    {provide: APP_BASE_HREF, useValue: '/'},
    {provide: HTTP_INTERCEPTORS, useClass: JwtInterceptor, multi: true},
    BsModalService
  ],
  bootstrap: [AppComponent]
})
export class AppModule {
  constructor(private iconLibrary: FaIconLibrary) {
    iconLibrary.addIcons(
      faArrowDown,
      faArrowLeft,
      faArrowUp,
      faArrowRight,
      faArrowRotateLeft,
      faArrowRotateRight,
      faBolt,
      faBorderNone,
      faCheck,
      faCircleNotch,
      faClone,
      faCog,
      faComments,
      faEye,
      faGlobe,
      faKey,
      faKeyboard,
      faLocationArrow,
      faPerson,
      faRightFromBracket,
      faRoad,
      faRotate,
      faTrashCan,
      faUser,
      faUsers,
      faVideo
    )
  }
}
