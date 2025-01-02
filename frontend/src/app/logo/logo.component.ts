import {ChangeDetectionStrategy, Component} from '@angular/core'

@Component({
  selector: 'app-logo',
  templateUrl: './logo.component.svg',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LogoComponent {}
