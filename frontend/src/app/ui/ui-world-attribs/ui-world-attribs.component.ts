import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  signal
} from '@angular/core'
import {FormsModule} from '@angular/forms'
import {MatCheckbox} from '@angular/material/checkbox'
import {MatDialogContent, MatDialogTitle} from '@angular/material/dialog'
import {MatFormField} from '@angular/material/form-field'
import {MatInput, MatLabel} from '@angular/material/input'
import {MatSlider, MatSliderThumb} from '@angular/material/slider'
import {MatTab, MatTabGroup, MatTabLabel} from '@angular/material/tabs'
import {FaIconComponent} from '@fortawesome/angular-fontawesome'
import {colorHexToStr, colorStrToHex, hexToRgb} from '../../utils/utils'
import {SkyService} from '../../world/sky.service'
import {TerrainService} from '../../world/terrain.service'
import {LightingService} from '../../world/lighting.service'
import {
  faMound,
  faPanorama,
  faSun,
  faWater
} from '@fortawesome/free-solid-svg-icons'
import {provideTranslocoScope, TranslocoDirective} from '@jsverse/transloco'

@Component({
  imports: [
    TranslocoDirective,
    FormsModule,
    MatCheckbox,
    MatDialogContent,
    MatDialogTitle,
    MatFormField,
    MatInput,
    MatLabel,
    MatSlider,
    MatSliderThumb,
    MatTab,
    MatTabGroup,
    MatTabLabel,
    FaIconComponent
  ],
  providers: [
    provideTranslocoScope({
      scope: 'ui/ui-world-attribs',
      alias: 'world-attribs'
    })
  ],
  selector: 'app-ui-world-attribs',
  templateUrl: './ui-world-attribs.component.html',
  styleUrl: './ui-world-attribs.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UiWorldAttribsComponent {
  protected readonly icon = {faMound, faPanorama, faSun, faWater}
  protected readonly skySvc = inject(SkyService)
  private readonly terrainSvc = inject(TerrainService)
  private readonly lightingSvc = inject(LightingService)

  protected terrain = signal(this.terrainSvc.terrain != null)
  protected fog = signal(this.lightingSvc.worldFog?.enabled ?? false)
  protected terrainOffset = signal(this.terrainSvc.terrain?.position.y ?? 0)
  protected fogMin = signal(this.lightingSvc.worldFog?.near ?? 0)
  protected fogMax = signal(this.lightingSvc.worldFog?.far ?? 120)
  protected lightDirX = signal(this.lightingSvc.dirLightTarget[0] | 0)
  protected lightDirY = signal(this.lightingSvc.dirLightTarget[1] | 0)
  protected lightDirZ = signal(this.lightingSvc.dirLightTarget[2] | 0)
  protected fogColor = signal(
    colorHexToStr(this.lightingSvc.worldFog?.color ?? 0x00007f)
  )
  protected ambLight = signal(colorHexToStr(this.lightingSvc.ambLightColor))
  protected dirLight = signal(colorHexToStr(this.lightingSvc.dirLightColor))
  protected water = signal(this.terrainSvc.water != null)
  protected waterColor = signal(
    colorHexToStr(this.terrainSvc.water?.userData?.color ?? 0x00ffff)
  )
  protected waterTextureBottom = signal(
    this.terrainSvc.water?.userData?.texture_bottom || ''
  )
  protected waterTextureTop = signal(
    this.terrainSvc.water?.userData?.texture_top || ''
  )
  protected waterLevel = signal(this.terrainSvc.water?.position.y ?? 0)
  protected waterOpacity = signal(
    this.terrainSvc.water?.userData.opacity ?? 128
  )
  protected waterUnderView = signal(
    this.terrainSvc.water?.userData?.under_view ?? 500
  )

  constructor() {
    effect(() => {
      this.lightingSvc.worldFog = {
        color: colorStrToHex(this.fogColor()),
        near: this.fogMin(),
        far: this.fogMax(),
        enabled: this.fog()
      }
    })
    effect(() => {
      this.lightingSvc.ambLightColor = colorStrToHex(this.ambLight())
    })
    effect(() => {
      this.lightingSvc.dirLightColor = colorStrToHex(this.dirLight())
    })
    effect(() => {
      this.lightingSvc.dirLightTarget = [
        this.lightDirX(),
        this.lightDirY(),
        this.lightDirZ()
      ]
    })
    effect(() => {
      this.terrainSvc.setTerrain({
        enabled: this.terrain(),
        offset: this.terrainOffset()
      })
    })
    effect(() => {
      this.terrainSvc.setWater({
        enabled: this.water(),
        color: hexToRgb(colorStrToHex(this.waterColor())),
        offset: this.waterLevel(),
        opacity: this.waterOpacity(),
        texture_bottom: this.waterTextureBottom(),
        texture_top: this.waterTextureTop(),
        under_view: this.waterUnderView()
      })
    })
  }
}
