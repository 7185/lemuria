import {ChangeDetectionStrategy, Component} from '@angular/core'

@Component({
  standalone: true,
  selector: 'app-logo',
  templateUrl: './logo.component.svg',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LogoComponent {}
