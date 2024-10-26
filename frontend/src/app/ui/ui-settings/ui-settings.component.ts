import {ChangeDetectionStrategy, Component, effect, inject} from '@angular/core'
import type {OnInit} from '@angular/core'
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

@Component({
  standalone: true,
  imports: [
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
  selector: 'app-ui-settings',
  templateUrl: './ui-settings.component.html',
  styleUrl: './ui-settings.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UiSettingsComponent implements OnInit {
  maxFps: number
  maxLights: number
  archivedMedia = false
  readonly dialogRef = inject(MatDialogRef<UiSettingsComponent>)
  private readonly engineSvc = inject(EngineService)
  private readonly settings = inject(SettingsService)

  constructor() {
    effect(() => {
      this.maxFps = this.engineSvc.maxFps()
      this.maxLights = this.engineSvc.maxLights()
    })
  }

  save() {
    this.engineSvc.maxFps.set(this.maxFps)
    this.engineSvc.maxLights.set(this.maxLights)
    this.settings.set('archivedMedia', this.archivedMedia)
  }

  ngOnInit(): void {
    this.settings.updated.subscribe(() => {
      this.archivedMedia = this.settings.get('archivedMedia')
    })
  }
}
