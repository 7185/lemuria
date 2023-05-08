import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  effect
} from '@angular/core'
import {FormsModule} from '@angular/forms'
import {EngineService} from '../../engine/engine.service'
import {SettingsService} from '../../settings/settings.service'

@Component({
  standalone: true,
  imports: [FormsModule],
  selector: 'app-ui-settings',
  templateUrl: './ui-settings.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UiSettingsComponent {
  @Output() closeModal = new EventEmitter()

  public maxFps: number
  public showLights: boolean

  constructor(
    private engineSvc: EngineService,
    private settings: SettingsService
  ) {
    this.showLights = this.settings.get('show_lights') || false
    effect(() => {
      this.maxFps = this.engineSvc.maxFps()
    })
  }

  close() {
    this.closeModal.emit()
  }

  save() {
    this.settings.set('show_lights', this.showLights)
    this.engineSvc.maxFps.set(this.maxFps)
    this.close()
  }
}
