import {NgModule} from '@angular/core'
import {BrowserModule} from '@angular/platform-browser'
import {FormsModule} from '@angular/forms'
import {AppComponent} from './app.component'
import {EngineComponent} from './engine/engine.component'
import {UiToolbarComponent} from './ui/ui-toolbar/ui-toolbar.component'
import {UiChatZoneComponent} from './ui/ui-chat-zone/ui-chat-zone.component'
import {UiComponent} from './ui/ui.component'

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
    FormsModule
  ],
  providers: [],
  bootstrap: [
    AppComponent
  ]
})
export class AppModule {
}
