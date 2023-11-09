import {importProvidersFrom} from '@angular/core'
import {APP_BASE_HREF} from '@angular/common'
import {provideHttpClient, withInterceptors} from '@angular/common/http'
import {bootstrapApplication} from '@angular/platform-browser'
import {provideAnimationsAsync} from '@angular/platform-browser/animations/async'
import {RouterModule} from '@angular/router'
import {APP_ROUTES} from './app/app-routing'
import {AppComponent} from './app/app.component'
import {jwtInterceptor} from './app/network'

bootstrapApplication(AppComponent, {
  providers: [
    importProvidersFrom(RouterModule.forRoot(APP_ROUTES)),
    provideAnimationsAsync(),
    provideHttpClient(withInterceptors([jwtInterceptor])),
    {provide: APP_BASE_HREF, useValue: '/'}
  ]
})
