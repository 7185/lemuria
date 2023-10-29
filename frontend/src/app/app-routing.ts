import type {Routes} from '@angular/router'
import {AuthGuard} from './auth/auth.guard.service'

export const APP_ROUTES: Routes = [
  {
    path: 'login',
    title: 'Lemuria | Sign in',
    loadComponent: () =>
      import('./auth/auth.component').then((mod) => mod.AuthComponent)
  },
  {
    path: '',
    title: 'Lemuria',
    canActivate: [AuthGuard],
    loadComponent: () =>
      import('./ui/ui.component').then((mod) => mod.UiComponent)
  },
  {
    path: '**',
    redirectTo: 'login',
    pathMatch: 'full'
  }
]
