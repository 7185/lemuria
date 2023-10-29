import {ChangeDetectionStrategy, Component, Inject} from '@angular/core'
import {FormsModule} from '@angular/forms'
import {MatButtonModule} from '@angular/material/button'
import {MAT_DIALOG_DATA, MatDialogModule} from '@angular/material/dialog'
import {MatFormFieldModule} from '@angular/material/form-field'
import {MatInputModule} from '@angular/material/input'
import {TeleportService} from '../../engine/teleport.service'
import {SettingsService} from '../../settings/settings.service'
import {WorldService} from '../../world/world.service'

@Component({
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule
  ],
  selector: 'app-ui-teleport',
  templateUrl: './ui-teleport.component.html',
  styleUrls: ['./ui-teleport.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UiTeleportComponent {
  public worldName: string
  public coordinates: string
  public name: string

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: {type: number},
    private teleportSvc: TeleportService,
    private settings: SettingsService,
    private world: WorldService
  ) {}

  go() {
    this.teleportSvc.teleport.set({
      world: this.worldName,
      position: this.coordinates,
      isNew: true
    })
  }

  makeHome() {
    this.settings.set('home', this.world.playerLocation)
  }

  save() {
    const teleportList = this.settings.get('teleports') || []
    teleportList.push({name: this.name, ...this.world.playerLocation})
    this.settings.set('teleports', teleportList)
  }
}
