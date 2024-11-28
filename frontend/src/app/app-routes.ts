import type {Routes} from '@angular/router'
import {AuthGuard} from './auth/auth.guard'

export const appRoutes: Routes = [
  {
    path: 'login',
    title: 'Lemuria | Sign in',
    loadComponent: async () =>
      (await import('./auth/auth.component')).AuthComponent
  },
  {
    path: '',
    title: 'Lemuria',
    canActivate: [AuthGuard],
    loadComponent: async () => (await import('./ui/ui.component')).UiComponent
  },
  {
    path: '**',
    redirectTo: 'login',
    pathMatch: 'full'
  }
]
