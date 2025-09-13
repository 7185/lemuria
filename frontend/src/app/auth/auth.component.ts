import {ChangeDetectionStrategy, Component, inject} from '@angular/core'
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms'
import {ActivatedRoute, Router} from '@angular/router'
import {MatButton, MatIconButton} from '@angular/material/button'
import {MatCard} from '@angular/material/card'
import {MatError, MatInput, MatSuffix} from '@angular/material/input'
import {MatFormField, MatLabel} from '@angular/material/form-field'
import {FaIconComponent} from '@fortawesome/angular-fontawesome'
import {finalize} from 'rxjs'
import {HttpService} from '../network'
import {LogoComponent} from '../logo/logo.component'
import {
  faCircleNotch,
  faEye,
  faEyeSlash,
  faKey,
  faUser
} from '@fortawesome/free-solid-svg-icons'
import {provideTranslocoScope, TranslocoDirective} from '@jsverse/transloco'
import {SettingsService} from '../settings/settings.service'

@Component({
  imports: [
    TranslocoDirective,
    ReactiveFormsModule,
    MatButton,
    MatCard,
    MatIconButton,
    MatError,
    MatInput,
    MatLabel,
    MatFormField,
    MatSuffix,
    FaIconComponent,
    LogoComponent
  ],
  providers: [provideTranslocoScope('auth')],
  selector: 'app-auth',
  templateUrl: './auth.component.html',
  styleUrl: './auth.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
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

  protected readonly http = inject(HttpService)
  private readonly fb = inject(FormBuilder)
  private readonly router = inject(Router)
  private readonly route = inject(ActivatedRoute)
  private readonly settings = inject(SettingsService)

  private readonly returnUrl = this.route.snapshot.queryParams.next || '/'
  usernameCtl = this.fb.control('', [
    Validators.required,
    Validators.minLength(2)
  ])
  passwordCtl = this.fb.control('', [Validators.required])
  loginForm = this.fb.group({
    username: this.usernameCtl,
    password: this.passwordCtl
  })

  constructor() {
    this.loginForm.setValue({
      username: this.settings.get('login') ?? '',
      password: ''
    })
    if (this.http.isLogged()) {
      this.router.navigate([this.returnUrl])
    }
  }

  onLogin(): void {
    this.processing = true
    this.http
      .login(this.loginForm.value.username, this.loginForm.value.password)
      .pipe(
        finalize(() => {
          this.processing = false
        })
      )
      .subscribe({
        next: () => {
          this.settings.set('login', this.loginForm.value.username)
          this.loginError = false
          this.router.navigate([this.returnUrl])
        },
        error: () => {
          this.loginError = true
        }
      })
  }
}
