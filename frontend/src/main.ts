import {APP_BASE_HREF} from '@angular/common'
import {provideHttpClient, withInterceptors} from '@angular/common/http'
import {provideBrowserGlobalErrorListeners} from '@angular/core'
import {bootstrapApplication} from '@angular/platform-browser'
import {provideRouter, withViewTransitions} from '@angular/router'
import {provideTransloco} from '@jsverse/transloco'
import {appRoutes} from './app/app-routes'
import {AppComponent} from './app/app.component'
import {TranslocoHttpLoader} from './app/i18n/transloco-loader'
import {jwtInterceptor} from './app/network'
import {environment} from './environments/environment'

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(appRoutes, withViewTransitions()),
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withInterceptors([jwtInterceptor])),
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
