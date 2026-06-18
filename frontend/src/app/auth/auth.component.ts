import {Component, inject, signal} from '@angular/core'
import {form, FormField, minLength, required} from '@angular/forms/signals'
import {MatButton, MatIconButton} from '@angular/material/button'
import {MatCard} from '@angular/material/card'
import {MatFormField, MatLabel} from '@angular/material/form-field'
import {MatError, MatInput, MatSuffix} from '@angular/material/input'
import {ActivatedRoute, Router} from '@angular/router'
import {FaIconComponent} from '@fortawesome/angular-fontawesome'
import {
  faCircleNotch,
  faEye,
  faEyeSlash,
  faKey,
  faUser
} from '@fortawesome/free-solid-svg-icons'
import {
  provideTranslocoScope,
  translateSignal,
  TranslocoDirective
} from '@jsverse/transloco'
import {finalize} from 'rxjs'
import {LogoComponent} from '../logo/logo.component'
import {SettingsService} from '../settings/settings.service'
import {AuthService} from './auth.service'

@Component({
  imports: [
    TranslocoDirective,
    MatButton,
    MatCard,
    MatIconButton,
    MatError,
    MatInput,
    MatLabel,
    MatFormField,
    MatSuffix,
    FaIconComponent,
    LogoComponent,
    FormField
  ],
  providers: [provideTranslocoScope('auth')],
  selector: 'app-auth',
  templateUrl: './auth.component.html',
  styleUrl: './auth.component.scss'
})
export class AuthComponent {
  protected readonly icon = {
    faCircleNotch,
    faEye,
    faEyeSlash,
    faKey,
    faUser
  }

  protected hide = true
  protected processing = false
  loginError = false

  protected readonly authSvc = inject(AuthService)
  private readonly router = inject(Router)
  private readonly route = inject(ActivatedRoute)
  private readonly settings = inject(SettingsService)

  private readonly returnUrl = this.route.snapshot.queryParams.next || '/'
  loginModel = signal<{username: string; password: string}>({
    username: this.settings.get('login') ?? '',
    password: ''
  })
  loginForm = form(this.loginModel, (fieldPath) => {
    required(fieldPath.username, {
      message: translateSignal('usernameRequired')
    })
    minLength(fieldPath.username, 2, {
      message: translateSignal('usernameTooShort')
    })
    required(fieldPath.password, {
      message: translateSignal('passwordRequired')
    })
  })

  constructor() {
    if (this.authSvc.isLogged()) {
      this.router.navigate([this.returnUrl])
    }
  }

  onLogin(event: Event): void {
    event.preventDefault()
    this.processing = true
    this.authSvc
      .login(this.loginModel().username, this.loginModel().password)
      .pipe(
        finalize(() => {
          this.processing = false
        })
      )
      .subscribe({
        next: () => {
          this.settings.set('login', this.loginModel().username)
          this.loginError = false
          this.router.navigate([this.returnUrl])
        },
        error: () => {
          this.loginError = true
        }
      })
  }
}
