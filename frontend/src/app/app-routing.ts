import type {Routes} from '@angular/router'
import {AuthGuard} from './auth/auth.guard.service'

export const APP_ROUTES: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./auth/auth.component').then((mod) => mod.AuthComponent)
  },
  {
    path: '',
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
