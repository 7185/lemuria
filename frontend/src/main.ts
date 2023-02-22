import {enableProdMode, importProvidersFrom} from '@angular/core'
import {APP_BASE_HREF} from '@angular/common'
import {
  provideHttpClient,
  HTTP_INTERCEPTORS,
  withInterceptorsFromDi
} from '@angular/common/http'
import {bootstrapApplication} from '@angular/platform-browser'
import {BrowserAnimationsModule} from '@angular/platform-browser/animations'
import {RouterModule} from '@angular/router'
import {BsModalService} from 'ngx-bootstrap/modal'
import {APP_ROUTES} from './app/app-routing'
import {AppComponent} from './app/app.component'
import {JwtInterceptor} from './app/network'
import {environment} from './environments/environment'

if (environment.production) {
  enableProdMode()
}

bootstrapApplication(AppComponent, {
  providers: [
    importProvidersFrom(RouterModule.forRoot(APP_ROUTES)),
    importProvidersFrom(BrowserAnimationsModule),
    provideHttpClient(withInterceptorsFromDi()),
    {provide: APP_BASE_HREF, useValue: '/'},
    {provide: HTTP_INTERCEPTORS, useClass: JwtInterceptor, multi: true},
    BsModalService
  ]
})
