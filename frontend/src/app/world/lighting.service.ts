import {inject, Injectable} from '@angular/core'
import {AmbientLight, Color, DirectionalLight, Object3D} from 'three'
import {EngineService} from '../engine/engine.service'

@Injectable({providedIn: 'root'})
export class LightingService {
  private light: AmbientLight
  private dirLight: DirectionalLight
  private dirLightTargetObj: Object3D
  private engineSvc = inject(EngineService)

  constructor() {
    this.light = new AmbientLight(0xffffff, 2.5)
    this.light.position.z = 100
    this.engineSvc.addWorldObject(this.light)

    this.dirLightTargetObj = new Object3D()
    this.dirLightTargetObj.position.set(-80, -50, -20)
    this.engineSvc.addWorldObject(this.dirLightTargetObj)

    this.dirLight = new DirectionalLight(0xffffff, 2)
    this.dirLight.name = 'dirLight'
    this.dirLight.shadow.camera.left = 100
    this.dirLight.shadow.camera.right = -100
    this.dirLight.shadow.camera.top = 100
    this.dirLight.shadow.camera.bottom = -100
    this.dirLight.shadow.mapSize.width = 2048
    this.dirLight.shadow.mapSize.height = 2048
    this.dirLight.target = this.dirLightTargetObj
    this.engineSvc.addWorldObject(this.dirLight)
  }

  public get ambLightColor(): number {
    return this.light.color.getHex()
  }

  public set ambLightColor(color: number) {
    this.light.color = new Color(color)
  }

  public get dirLightColor(): number {
    return this.dirLight.color.getHex()
  }

  public set dirLightColor(color: number) {
    this.dirLight.color = new Color(color)
  }

  public get dirLightTarget(): number[] {
    return this.dirLightTargetObj.position.toArray()
  }

  public set dirLightTarget(position: number[]) {
    this.dirLightTargetObj.position.set(position[0], position[1], position[2])
  }

  public set worldFog(worldFog: {
    color: number
    near: number
    far: number
    enabled: boolean
  }) {
    this.engineSvc.worldFog = {...this.engineSvc.worldFog, ...worldFog}
    this.engineSvc.updateFog()
  }

  public get worldFog() {
    return this.engineSvc.worldFog
  }
}
