import {NgModule} from '@angular/core'
import {RouterModule, Routes} from '@angular/router'
import {AuthComponent} from './auth/auth.component'
import {AuthGuard} from './auth/auth.guard.service'
import {UiComponent} from './ui/ui.component'

const appRoutes: Routes = [
  {
    path: 'login',
    component: AuthComponent
  },
  {
    path: '',
    canActivate: [AuthGuard],
    component: UiComponent
  },
  {
    path: '**',
    redirectTo: 'login',
    pathMatch: 'full'
  }
]

/**
 * Main module routing
 */
@NgModule({
  imports: [RouterModule.forRoot(appRoutes)],
  exports: [RouterModule],
  providers: [AuthGuard]
})
export class AppRoutingModule {
}

export const routingComponents = [
  AuthComponent,
  UiComponent
]
