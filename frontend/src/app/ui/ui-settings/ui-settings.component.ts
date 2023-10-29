import {ChangeDetectionStrategy, Component, effect} from '@angular/core'
import {MatButtonModule} from '@angular/material/button'
import {MatDialogModule, MatDialogRef} from '@angular/material/dialog'
import {MatFormFieldModule} from '@angular/material/form-field'
import {MatInputModule} from '@angular/material/input'
import {FormsModule} from '@angular/forms'
import {EngineService} from '../../engine/engine.service'

@Component({
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatInputModule,
    MatFormFieldModule
  ],
  selector: 'app-ui-settings',
  templateUrl: './ui-settings.component.html',
  styleUrls: ['./ui-settings.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UiSettingsComponent {
  public maxFps: number
  public maxLights: number

  constructor(
    public dialogRef: MatDialogRef<UiSettingsComponent>,
    private engineSvc: EngineService
  ) {
    effect(() => {
      this.maxFps = this.engineSvc.maxFps()
      this.maxLights = this.engineSvc.maxLights()
    })
  }

  save() {
    this.engineSvc.maxFps.set(this.maxFps)
    this.engineSvc.maxLights.set(this.maxLights)
  }
}
