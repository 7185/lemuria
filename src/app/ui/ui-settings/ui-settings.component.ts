import {Component, EventEmitter, Output} from '@angular/core'

@Component({
  selector: 'app-ui-settings',
  templateUrl: './ui-settings.component.html'
})
export class UiSettingsComponent {

  @Output() closeModal = new EventEmitter()

  close() {
    this.closeModal.emit()
  }
}
