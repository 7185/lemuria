import {ChangeDetectionStrategy, Component, inject} from '@angular/core'
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms'
import type {FormControl, FormGroup} from '@angular/forms'
import {ActivatedRoute, Router} from '@angular/router'
import {MatButton, MatIconButton} from '@angular/material/button'
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
import {TranslocoModule} from '@jsverse/transloco'

@Component({
  imports: [
    TranslocoModule,
    ReactiveFormsModule,
    MatButton,
    MatIconButton,
    MatError,
    MatInput,
    MatLabel,
    MatFormField,
    MatSuffix,
    FaIconComponent,
    LogoComponent
  ],
  selector: 'app-auth',
  templateUrl: './auth.component.html',
  styleUrl: './auth.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AuthComponent {
  faCircleNotch = faCircleNotch
  faEye = faEye
  faEyeSlash = faEyeSlash
  faKey = faKey
  faUser = faUser

  hide = true
  processing = false
  loginForm: FormGroup
  loginError = false
  usernameCtl: FormControl<string | null>
  passwordCtl: FormControl<string | null>
  private returnUrl: string

  protected readonly http = inject(HttpService)
  private readonly fb = inject(FormBuilder)
  private readonly router = inject(Router)
  private readonly route = inject(ActivatedRoute)

  constructor() {
    this.usernameCtl = this.fb.control('', [
      Validators.required,
      Validators.minLength(2)
    ])
    this.passwordCtl = this.fb.control('', [Validators.required])
    this.loginForm = this.fb.group({
      username: this.usernameCtl,
      password: this.passwordCtl
    })

    this.loginForm.setValue({
      username: localStorage.getItem('login') ?? '',
      password: ''
    })
    this.returnUrl = this.route.snapshot.queryParams.next || '/'
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
          localStorage.setItem('login', this.loginForm.value.username)
          this.loginError = false
          this.router.navigate([this.returnUrl])
        },
        error: () => {
          this.loginError = true
        }
      })
  }
}
