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
import {appRoutes} from './app/app-routes'
import {jwtInterceptor} from './app/network'
import {TranslocoHttpLoader} from './app/i18n/transloco-loader'
import {provideTransloco} from '@jsverse/transloco'
import {environment} from './environments/environment'

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(appRoutes, withViewTransitions()),
    provideExperimentalZonelessChangeDetection(),
    provideAnimationsAsync(),
    provideHttpClient(withFetch(), withInterceptors([jwtInterceptor])),
    provideTransloco({
      config: {
        availableLangs: [
          {id: 'en', label: 'English'},
          {id: 'fr', label: 'Français'}
        ],
        defaultLang: 'en',
        fallbackLang: 'en',
        reRenderOnLangChange: true,
        prodMode: !environment.debug
      },
      loader: TranslocoHttpLoader
    }),
    {provide: APP_BASE_HREF, useValue: '/'}
  ]
})
