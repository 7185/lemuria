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

@Component({
  standalone: true,
  imports: [FormsModule, TabsModule],
  selector: 'app-ui-world-attribs',
  templateUrl: './ui-world-attribs.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UiWorldAttribsComponent {
  @Output() closeModal = new EventEmitter()

  public fogColor: WritableSignal<string>
  public ambLight: WritableSignal<string>
  public dirLight: WritableSignal<string>
  public lightDirX: WritableSignal<number>
  public lightDirY: WritableSignal<number>
  public lightDirZ: WritableSignal<number>
  public fog: WritableSignal<boolean>
  public fogMin: WritableSignal<number>
  public fogMax: WritableSignal<number>
  public skybox: WritableSignal<string>

  constructor(private engineSvc: EngineService, public worldSvc: WorldService) {
    this.fog = signal(false)
    this.fogMin = signal(0)
    this.fogMax = signal(120)
    this.lightDirX = signal(this.engineSvc.getDirLightTarget()[0] | 0)
    this.lightDirY = signal(this.engineSvc.getDirLightTarget()[1] | 0)
    this.lightDirZ = signal(this.engineSvc.getDirLightTarget()[2] | 0)

    this.fogColor = signal(
      Utils.colorHexToStr(this.engineSvc.getFog()?.color.getHex() || 0x00007f)
    )
    this.ambLight = signal(
      Utils.colorHexToStr(this.engineSvc.getAmbLightColor())
    )
    this.dirLight = signal(
      Utils.colorHexToStr(this.engineSvc.getDirLightColor())
    )

    effect(() => {
      this.engineSvc.setFog(
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
  }

  close() {
    this.closeModal.emit()
  }
}
