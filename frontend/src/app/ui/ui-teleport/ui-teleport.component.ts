import {ChangeDetectionStrategy, Component, inject} from '@angular/core'
import {FormsModule} from '@angular/forms'
import {MatButton} from '@angular/material/button'
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogTitle,
  MatDialogClose
} from '@angular/material/dialog'
import {MatFormField, MatLabel} from '@angular/material/form-field'
import {MatInput} from '@angular/material/input'
import {TeleportService} from '../../engine/teleport.service'
import {SettingsService} from '../../settings/settings.service'
import {WorldService} from '../../world/world.service'

@Component({
  standalone: true,
  imports: [
    FormsModule,
    MatButton,
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
    MatDialogTitle,
    MatFormField,
    MatInput,
    MatLabel
  ],
  selector: 'app-ui-teleport',
  templateUrl: './ui-teleport.component.html',
  styleUrl: './ui-teleport.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UiTeleportComponent {
  worldName: string
  coordinates: string
  name: string
  data: {type: number} = inject(MAT_DIALOG_DATA)

  private readonly teleportSvc = inject(TeleportService)
  private readonly settings = inject(SettingsService)
  private readonly world = inject(WorldService)

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
