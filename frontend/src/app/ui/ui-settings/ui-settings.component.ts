import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  effect
} from '@angular/core'
import {FormsModule} from '@angular/forms'
import {EngineService} from '../../engine/engine.service'

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

  constructor(private engineSvc: EngineService) {
    effect(() => {
      this.maxFps = this.engineSvc.maxFps()
    })
  }

  close() {
    this.closeModal.emit()
  }

  save() {
    this.engineSvc.maxFps.set(this.maxFps)
    this.close()
  }
}
