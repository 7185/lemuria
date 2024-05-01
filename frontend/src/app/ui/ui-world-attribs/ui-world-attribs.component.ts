import {ChangeDetectionStrategy, Component, effect, signal} from '@angular/core'
import type {WritableSignal} from '@angular/core'
import {FormsModule} from '@angular/forms'
import {MatCheckboxModule} from '@angular/material/checkbox'
import {MatDialogModule} from '@angular/material/dialog'
import {MatFormFieldModule} from '@angular/material/form-field'
import {MatInputModule} from '@angular/material/input'
import {MatSliderModule} from '@angular/material/slider'
import {MatTabsModule} from '@angular/material/tabs'
import {Utils} from '../../utils'
import {WorldService} from 'src/app/world/world.service'
import {TerrainService} from 'src/app/world/terrain.service'
import {LightingService} from 'src/app/world/lighting.service'

@Component({
  standalone: true,
  imports: [
    FormsModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSliderModule,
    MatTabsModule
  ],
  selector: 'app-ui-world-attribs',
  templateUrl: './ui-world-attribs.component.html',
  styleUrl: './ui-world-attribs.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UiWorldAttribsComponent {
  terrain: WritableSignal<boolean>
  terrainOffset: WritableSignal<number>
  ambLight: WritableSignal<string>
  dirLight: WritableSignal<string>
  lightDirX: WritableSignal<number>
  lightDirY: WritableSignal<number>
  lightDirZ: WritableSignal<number>
  fog: WritableSignal<boolean>
  fogColor: WritableSignal<string>
  fogMin: WritableSignal<number>
  fogMax: WritableSignal<number>
  skybox: WritableSignal<string>
  water: WritableSignal<boolean>
  waterColor: WritableSignal<string>
  waterTextureBottom: WritableSignal<string>
  waterTextureTop: WritableSignal<string>
  waterLevel: WritableSignal<number>
  waterOpacity: WritableSignal<number>
  waterUnderView: WritableSignal<number>

  constructor(
    private terrainSvc: TerrainService,
    private lightingSvc: LightingService,
    public worldSvc: WorldService
  ) {
    this.terrain = signal(this.terrainSvc.terrain != null)
    this.terrainOffset = signal(this.terrainSvc.terrain?.position.y ?? 0)
    this.fog = signal(this.lightingSvc.worldFog?.enabled ?? false)
    this.fogMin = signal(this.lightingSvc.worldFog?.near ?? 0)
    this.fogMax = signal(this.lightingSvc.worldFog?.far ?? 120)
    this.lightDirX = signal(this.lightingSvc.dirLightTarget[0] | 0)
    this.lightDirY = signal(this.lightingSvc.dirLightTarget[1] | 0)
    this.lightDirZ = signal(this.lightingSvc.dirLightTarget[2] | 0)

    this.fogColor = signal(
      Utils.colorHexToStr(this.lightingSvc.worldFog?.color ?? 0x00007f)
    )
    this.ambLight = signal(Utils.colorHexToStr(this.lightingSvc.ambLightColor))
    this.dirLight = signal(Utils.colorHexToStr(this.lightingSvc.dirLightColor))
    this.water = signal(this.terrainSvc.water != null)
    this.waterColor = signal(
      Utils.colorHexToStr(this.terrainSvc.water?.userData?.color ?? 0x00ffff)
    )
    this.waterTextureBottom = signal(
      this.terrainSvc.water?.userData?.texture_bottom || ''
    )
    this.waterTextureTop = signal(
      this.terrainSvc.water?.userData?.texture_top || ''
    )
    this.waterLevel = signal(this.terrainSvc.water?.position.y ?? 0)
    this.waterOpacity = signal(this.terrainSvc.water?.userData.opacity ?? 128)
    this.waterUnderView = signal(
      this.terrainSvc.water?.userData?.under_view ?? 500
    )

    effect(() => {
      this.lightingSvc.worldFog = {
        color: Utils.colorStrToHex(this.fogColor()),
        near: this.fogMin(),
        far: this.fogMax(),
        enabled: this.fog()
      }
    })
    effect(() => {
      this.lightingSvc.ambLightColor = Utils.colorStrToHex(this.ambLight())
    })
    effect(() => {
      this.lightingSvc.dirLightColor = Utils.colorStrToHex(this.dirLight())
    })
    effect(() => {
      this.lightingSvc.dirLightTarget = [
        this.lightDirX(),
        this.lightDirY(),
        this.lightDirZ()
      ]
    })
    effect(() => {
      this.terrainSvc.setTerrain(
        {
          enabled: this.terrain(),
          offset: this.terrainOffset()
        },
        this.worldSvc.worldId
      )
    })
    effect(() => {
      this.terrainSvc.setWater({
        enabled: this.water(),
        color: [...Utils.hexToRgb(Utils.colorStrToHex(this.waterColor()))],
        offset: this.waterLevel(),
        opacity: this.waterOpacity(),
        texture_bottom: this.waterTextureBottom(),
        texture_top: this.waterTextureTop(),
        under_view: this.waterUnderView()
      })
    })
  }
}
