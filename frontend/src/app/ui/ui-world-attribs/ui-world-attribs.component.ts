import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  effect,
  signal
} from '@angular/core'
import type {WritableSignal} from '@angular/core'
import {FormsModule} from '@angular/forms'
import {TabsModule} from 'ngx-bootstrap/tabs'
import {EngineService} from '../../engine/engine.service'
import {Utils} from '../../utils'
import {WorldService} from 'src/app/world/world.service'
import {TerrainService} from 'src/app/world/terrain.service'

@Component({
  standalone: true,
  imports: [FormsModule, TabsModule],
  selector: 'app-ui-world-attribs',
  templateUrl: './ui-world-attribs.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UiWorldAttribsComponent {
  @Output() closeModal = new EventEmitter()

  public ambLight: WritableSignal<string>
  public dirLight: WritableSignal<string>
  public lightDirX: WritableSignal<number>
  public lightDirY: WritableSignal<number>
  public lightDirZ: WritableSignal<number>
  public fog: WritableSignal<boolean>
  public fogColor: WritableSignal<string>
  public fogMin: WritableSignal<number>
  public fogMax: WritableSignal<number>
  public skybox: WritableSignal<string>
  public water: WritableSignal<boolean>
  public waterColor: WritableSignal<string>
  public waterTextureBottom: WritableSignal<string>
  public waterTextureTop: WritableSignal<string>
  public waterLevel: WritableSignal<number>
  public waterOpacity: WritableSignal<number>
  public waterUnderView: WritableSignal<number>

  constructor(
    private engineSvc: EngineService,
    private terrainSvc: TerrainService,
    public worldSvc: WorldService
  ) {
    this.fog = signal(this.engineSvc.getWorldFog()?.enabled ?? false)
    this.fogMin = signal(this.engineSvc.getWorldFog()?.near ?? 0)
    this.fogMax = signal(this.engineSvc.getWorldFog()?.far ?? 120)
    this.lightDirX = signal(this.engineSvc.getDirLightTarget()[0] | 0)
    this.lightDirY = signal(this.engineSvc.getDirLightTarget()[1] | 0)
    this.lightDirZ = signal(this.engineSvc.getDirLightTarget()[2] | 0)

    this.fogColor = signal(
      Utils.colorHexToStr(this.engineSvc.getWorldFog()?.color ?? 0x00007f)
    )
    this.ambLight = signal(
      Utils.colorHexToStr(this.engineSvc.getAmbLightColor())
    )
    this.dirLight = signal(
      Utils.colorHexToStr(this.engineSvc.getDirLightColor())
    )
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
      this.engineSvc.setWorldFog(
        Utils.colorStrToHex(this.fogColor()),
        this.fogMin(),
        this.fogMax(),
        this.fog()
      )
    })
    effect(() => {
      this.engineSvc.setAmbLightColor(Utils.colorStrToHex(this.ambLight()))
    })
    effect(() => {
      this.engineSvc.setDirLightColor(Utils.colorStrToHex(this.dirLight()))
    })
    effect(() => {
      this.engineSvc.setDirLightTarget(
        this.lightDirX(),
        this.lightDirY(),
        this.lightDirZ()
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

  close() {
    this.closeModal.emit()
  }
}
