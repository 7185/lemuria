import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output
} from '@angular/core'
import {NgIf} from '@angular/common'
import {FormsModule} from '@angular/forms'
import {TeleportService} from '../../engine/teleport.service'
import {SettingsService} from '../../settings/settings.service'
import {WorldService} from '../../world/world.service'

@Component({
  standalone: true,
  imports: [FormsModule, NgIf],
  selector: 'app-ui-teleport',
  templateUrl: './ui-teleport.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UiTeleportComponent {
  @Input() type = 0
  @Output() closeModal = new EventEmitter()

  public worldName: string
  public coordinates: string
  public name: string

  constructor(
    private teleportSvc: TeleportService,
    private settings: SettingsService,
    private world: WorldService
  ) {}

  close() {
    this.closeModal.emit()
  }

  go() {
    this.teleportSvc.teleport.set({
      world: this.worldName,
      position: this.coordinates,
      isNew: true
    })
    this.close()
  }

  makeHome() {
    this.settings.set('home', this.world.getPosition())
    this.close()
  }

  save() {
    const teleportList = this.settings.get('teleports') || []
    teleportList.push({name: this.name, ...this.world.getPosition()})
    this.settings.set('teleports', teleportList)
    this.close()
  }
}
