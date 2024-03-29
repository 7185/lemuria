import {ChangeDetectionStrategy, Component} from '@angular/core'
import type {OnInit} from '@angular/core'
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms'
import type {FormControl, FormGroup} from '@angular/forms'
import {ActivatedRoute, Router} from '@angular/router'
import {MatButtonModule} from '@angular/material/button'
import {MatInputModule} from '@angular/material/input'
import {MatFormFieldModule} from '@angular/material/form-field'
import {FontAwesomeModule} from '@fortawesome/angular-fontawesome'
import {finalize} from 'rxjs/operators'
import {HttpService} from '../network'
import {SettingsService} from '../settings/settings.service'
import {LogoComponent} from '../logo/logo.component'
import {
  faCircleNotch,
  faEye,
  faEyeSlash,
  faKey,
  faUser
} from '@fortawesome/free-solid-svg-icons'

@Component({
  standalone: true,
  imports: [
    FontAwesomeModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatInputModule,
    MatFormFieldModule,
    LogoComponent
  ],
  selector: 'app-auth',
  templateUrl: './auth.component.html',
  styleUrl: './auth.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AuthComponent implements OnInit {
  public faCircleNotch = faCircleNotch
  public faEye = faEye
  public faEyeSlash = faEyeSlash
  public faKey = faKey
  public faUser = faUser

  public hide = true
  public processing = false
  public loginForm: FormGroup
  public loginError = false
  public usernameCtl: FormControl<string | null>
  public passwordCtl: FormControl<string | null>
  private returnUrl: string

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private http: HttpService,
    private settings: SettingsService
  ) {
    this.usernameCtl = fb.control('', [
      Validators.required,
      Validators.minLength(2)
    ])
    this.passwordCtl = fb.control('', [Validators.required])
    this.loginForm = fb.group({
      username: this.usernameCtl,
      password: this.passwordCtl
    })
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

  ngOnInit() {
    this.loginForm.setValue({
      username: this.settings.get('login'),
      password: ''
    })
    this.returnUrl = this.route.snapshot.queryParams.next || '/'
    if (this.http.isLogged()) {
      this.router.navigate([this.returnUrl])
    }
    this.loginForm.value.username = localStorage.getItem('login') || 'Anonymous'
  }
}
