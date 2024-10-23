import {APP_BASE_HREF} from '@angular/common'
import {
  provideHttpClient,
  withFetch,
  withInterceptors
} from '@angular/common/http'
import {provideExperimentalZonelessChangeDetection} from '@angular/core'
import {provideRouter, withViewTransitions} from '@angular/router'
import {bootstrapApplication} from '@angular/platform-browser'
import {provideAnimationsAsync} from '@angular/platform-browser/animations/async'
import {AppComponent} from './app/app.component'
import {APP_ROUTES} from './app/app-routing'
import {jwtInterceptor} from './app/network'

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(APP_ROUTES, withViewTransitions()),
    provideExperimentalZonelessChangeDetection(),
    provideAnimationsAsync(),
    provideHttpClient(withFetch(), withInterceptors([jwtInterceptor])),
    {provide: APP_BASE_HREF, useValue: '/'}
  ]
})
