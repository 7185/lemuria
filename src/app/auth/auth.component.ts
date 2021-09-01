import {Component} from '@angular/core'
import type {OnInit} from '@angular/core'
import {FormBuilder, Validators} from '@angular/forms'
import type {FormControl, FormGroup} from '@angular/forms'
import {ActivatedRoute, Router} from '@angular/router'
import {finalize} from 'rxjs/operators'
import {HttpService} from '../network/http.service'

@Component({
  selector: 'app-auth',
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.scss']
})

export class AuthComponent implements OnInit {

  public processing = false
  public loginForm: FormGroup
  public loginError = false
  public usernameCtl: FormControl
  public passwordCtl: FormControl
  private returnUrl: string

  constructor(private fb: FormBuilder,
              private router: Router,
              private route: ActivatedRoute,
              private http: HttpService) {
    this.usernameCtl = fb.control('', [Validators.required, Validators.minLength(2)])
    this.passwordCtl = fb.control('', [Validators.required])
    this.loginForm = fb.group({username: this.usernameCtl, password: this.passwordCtl})
  }

  onLogin(): void {
    this.processing = true
    this.http.login(this.loginForm.value.username, this.loginForm.value.password)
      .pipe(finalize(() => {
        this.processing = false
      }))
      .subscribe({
        next: () => {
          this.loginError = false
          this.router.navigate([this.returnUrl])
        },
        error: () => {
          this.loginError = true
        }
      })
  }

  ngOnInit() {
    this.returnUrl = this.route.snapshot.queryParams.next || '/'
    if (this.http.isLogged()) {
      this.router.navigate([this.returnUrl])
    }
    this.loginForm.value.username = localStorage.getItem('login') || 'Anonymous'
  }
}
