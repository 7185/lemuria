import {Component, EventEmitter, Output} from '@angular/core'
import {FormsModule} from '@angular/forms'
import type {OnInit} from '@angular/core'
import {EngineService} from '../../engine/engine.service'

@Component({
  standalone: true,
  imports: [FormsModule],
  selector: 'app-ui-settings',
  templateUrl: './ui-settings.component.html'
})
export class UiSettingsComponent implements OnInit {
  @Output() closeModal = new EventEmitter()

  public maxFps: number

  constructor(private engineSvc: EngineService) {}

  close() {
    this.closeModal.emit()
  }

  save() {
    this.engineSvc.maxFps.next(this.maxFps)
    this.close()
  }

  ngOnInit() {
    this.engineSvc.maxFps.subscribe((fps) => {
      this.maxFps = fps
    })
  }
}
