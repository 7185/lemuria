import {ChangeDetectionStrategy, Component, inject} from '@angular/core'
import {MatButton} from '@angular/material/button'
import {MatCheckbox} from '@angular/material/checkbox'
import {
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle
} from '@angular/material/dialog'
import {MatFormField} from '@angular/material/form-field'
import {MatInput, MatLabel} from '@angular/material/input'
import {FormsModule} from '@angular/forms'
import {EngineService} from '../../engine/engine.service'
import {SettingsService} from '../../settings/settings.service'
import {provideTranslocoScope, TranslocoDirective} from '@jsverse/transloco'

@Component({
  imports: [
    TranslocoDirective,
    FormsModule,
    MatButton,
    MatCheckbox,
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
    MatDialogTitle,
    MatInput,
    MatLabel,
    MatFormField
  ],
  providers: [
    provideTranslocoScope({scope: 'ui/ui-settings', alias: 'settings'})
  ],
  selector: 'app-ui-settings',
  templateUrl: './ui-settings.component.html',
  styleUrl: './ui-settings.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UiSettingsComponent {
  maxFps: number
  maxLights: number
  protected archivedMedia = false
  protected readonly dialogRef = inject(MatDialogRef<UiSettingsComponent>)
  private readonly engineSvc = inject(EngineService)
  private readonly settings = inject(SettingsService)

  constructor() {
    this.maxFps = this.engineSvc.maxFps()
    this.maxLights = this.engineSvc.maxLights()
    this.settings.updated.subscribe(() => {
      this.archivedMedia = this.settings.get('archivedMedia')
    })
  }

  save() {
    this.engineSvc.maxFps.set(this.maxFps)
    this.engineSvc.maxLights.set(this.maxLights)
    this.settings.set('archivedMedia', this.archivedMedia)
  }
}
