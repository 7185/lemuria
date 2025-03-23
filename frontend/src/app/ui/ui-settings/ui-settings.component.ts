import {
  ChangeDetectionStrategy,
  Component,
  inject,
  model,
  signal
} from '@angular/core'
import {MatButton} from '@angular/material/button'
import {MatCheckbox} from '@angular/material/checkbox'
import {
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogTitle
} from '@angular/material/dialog'
import {MatFormField} from '@angular/material/form-field'
import {MatInput, MatLabel} from '@angular/material/input'
import {FormsModule} from '@angular/forms'
import {EngineService} from '../../engine/engine.service'
import {SettingsService} from '../../settings/settings.service'
import type {LangDefinition} from '@jsverse/transloco'
import {
  provideTranslocoScope,
  TranslocoDirective,
  TranslocoService
} from '@jsverse/transloco'
import {MatOption, MatSelect} from '@angular/material/select'
import {toObservable} from '@angular/core/rxjs-interop'

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
    MatOption,
    MatSelect,
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
  protected archivedMedia = signal(false)
  protected verticalChat = signal(true)
  private readonly engineSvc = inject(EngineService)
  private readonly settings = inject(SettingsService)
  private readonly translocoSvc = inject(TranslocoService)
  protected language = model(
    this.settings.get('lang') ?? this.translocoSvc.getActiveLang()
  )
  protected languages =
    this.translocoSvc.getAvailableLangs() as LangDefinition[]

  constructor() {
    toObservable(this.language).subscribe((lang) => {
      this.translocoSvc.setActiveLang(lang)
      this.settings.set('lang', lang)
    })
    toObservable(this.verticalChat).subscribe((verticalChat) => {
      this.settings.set('verticalChat', verticalChat)
    })
    this.maxFps = this.engineSvc.maxFps()
    this.maxLights = this.engineSvc.maxLights()
    this.settings.updated.subscribe(() => {
      this.archivedMedia.set(this.settings.get('archivedMedia') ?? false)
      this.verticalChat.set(this.settings.get('verticalChat') ?? true)
    })
  }

  save() {
    this.engineSvc.maxFps.set(this.maxFps)
    this.engineSvc.maxLights.set(this.maxLights)
    this.settings.set('archivedMedia', this.archivedMedia() ?? false)
  }
}
