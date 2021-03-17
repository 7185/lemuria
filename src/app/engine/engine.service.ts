import {Subject} from 'rxjs'
import {ElementRef, Injectable, NgZone, OnDestroy} from '@angular/core'
import {
  AmbientLight, BoxHelper, Clock, Material, PerspectiveCamera, Raycaster, Scene, GridHelper, Group,
  Vector2, Vector3, WebGLRenderer, DirectionalLight, PCFSoftShadowMap, CameraHelper, Object3D, Spherical
} from 'three'

import {UserService} from './../user/user.service'
import {config} from '../app.config'

export const enum PressedKey { up = 0, right, down, left, pgUp, pgDown, plus, minus, ctrl, shift, esc }
export const DEG = Math.PI / 180

@Injectable({providedIn: 'root'})
export class EngineService implements OnDestroy {

  public compass: Subject<any> = new Subject()
  private canvas: HTMLCanvasElement
  private labelZone: HTMLDivElement
  private renderer: WebGLRenderer
  private clock: Clock
  private camera: PerspectiveCamera
  private thirdCamera: PerspectiveCamera
  private activeCamera: PerspectiveCamera
  private player: Object3D
  private scene: Scene
  private light: AmbientLight
  private dirLight: DirectionalLight
  private avatar: Group
  private buildMode = false
  private selectedObject: Group

  private frameId: number = null
  private deltaSinceLastFrame = 0

  private selectionBox: BoxHelper
  private controls: boolean[] = Array(9).fill(false)

  private mouse = new Vector2()
  private raycaster = new Raycaster()

  public constructor(private ngZone: NgZone, private userSvc: UserService) {
  }

  public ngOnDestroy(): void {
    if (this.frameId != null) {
      cancelAnimationFrame(this.frameId)
    }
  }

  public createScene(canvas: ElementRef<HTMLCanvasElement>, labelZone: ElementRef<HTMLDivElement>): void {
    this.canvas = canvas.nativeElement
    this.labelZone = labelZone.nativeElement

    this.renderer = new WebGLRenderer({
      canvas: this.canvas,
      alpha: true,    // transparent background
      antialias: true // smooth edges
    })
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = PCFSoftShadowMap

    this.scene = new Scene()

    this.player = new Object3D()
    this.player.rotation.order = 'YXZ'
    this.scene.add(this.player)

    this.camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
    this.camera.rotation.order = 'YXZ'
    this.camera.position.y = 0
    this.player.attach(this.camera)

    this.thirdCamera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
    this.thirdCamera.rotation.order = 'YXZ'
    this.thirdCamera.position.z = 5
    this.thirdCamera.position.y = 0.5
    this.camera.attach(this.thirdCamera)

    this.activeCamera = this.camera

    this.light = new AmbientLight(0x404040)
    this.light.position.z = 100
    this.scene.add(this.light)

    this.dirLight = new DirectionalLight(0x10100f, 10)
    this.dirLight.name = 'dirlight'
    this.dirLight.userData.persist = true
    this.dirLight.position.set(-50, 80, 10)
    this.dirLight.castShadow = true
    this.dirLight.shadow.camera.left = 100
    this.dirLight.shadow.camera.right = -100
    this.dirLight.shadow.camera.top = 100
    this.dirLight.shadow.camera.bottom = -100
    this.dirLight.shadow.mapSize.width = 2048
    this.dirLight.shadow.mapSize.height = 2048
    this.dirLight.target = this.camera
    this.scene.add(this.dirLight)

    if (config.debug) {
      const shadowHelper = new CameraHelper(this.dirLight.shadow.camera)
      this.scene.add(shadowHelper)
      const gridHelper = new GridHelper(1000, 100, 0xff0000, 0x00ffff)
      this.scene.add(gridHelper)
    }
  }

  public createTextLabel(group: Group) {
    const div = document.createElement('div')
    div.className = 'text-label'
    div.id = 'label-' + group.name
    div.style.position = 'absolute'
    div.style.transform = 'translate(-50%, -100%)'
    const user = this.userSvc.userList.find(u => u.id === group.name)
    div.innerHTML = user ? user.name : ''
    this.labelZone.appendChild(div)
  }

  public getPosition(): [Vector3, Vector3] {
    const p = this.player.position.clone()
    const o = this.player.rotation.toVector3()
    return [p, o]
  }

  public setBackground(bg) {
    this.scene.background = bg
  }

  public attachCam(group: Group) {
    this.avatar = group
    this.avatar.visible = this.activeCamera === this.thirdCamera
    this.player.attach(this.avatar)
  }

  public setCameraOffset(offset) {
    this.camera.position.y = offset
  }

  public addObject(group: Group) {
    this.scene.add(group)
  }

  public removeObject(group: Group) {
    if (group === this.selectedObject) {
      this.buildMode = false
      this.selectedObject = null
      this.selectionBox.geometry.dispose()
      this.scene.remove(this.selectionBox)
    }
    this.scene.remove(group)
  }

  public objects() {
    return this.scene.children
  }

  public select(item: Group) {
    if (this.selectionBox != null) {
      this.buildMode = false
      this.selectedObject = null
      this.selectionBox.geometry.dispose()
      this.scene.remove(this.selectionBox)
    }
      this.buildMode = true
      this.selectedObject = item
      this.selectionBox = new BoxHelper(item, 0xffff00)
      ;(this.selectionBox.material as Material).depthTest = false
      this.scene.add(this.selectionBox)
      this.selectionBox.setFromObject(item)
  }

  public animate(): void {
    // We have to run this outside angular zones,
    // because it could trigger heavy changeDetection cycles.
    this.ngZone.runOutsideAngular(() => {
      this.clock = new Clock(true)
      if (document.readyState !== 'loading') {
        this.render()
      } else {
        window.addEventListener('DOMContentLoaded', () => {
          this.render()
        })
      }
      window.addEventListener('resize', () => {
        this.resize()
      })
      this.canvas.addEventListener('contextmenu', (e: MouseEvent) => {
        this.rightClick(e)
      })
      window.addEventListener('keydown', (e: KeyboardEvent) => {
        if ((e.target as HTMLElement).nodeName === 'BODY') {
          this.handleKeys(e.code, true)
          if (this.buildMode) {
            this.moveItem()
          }
          e.preventDefault()
        }
      })
      window.addEventListener('keyup', (e: KeyboardEvent) => {
        if ((e.target as HTMLElement).nodeName === 'BODY') {
          this.handleKeys(e.code, false)
          e.preventDefault()
        }
      })
    })
  }

  public toggleCamera() {
    this.activeCamera = this.activeCamera === this.camera ? this.thirdCamera : this.camera
    this.avatar.visible = this.activeCamera === this.thirdCamera
  }

  private render(): void {
    this.frameId = requestAnimationFrame(() => {
      this.render()
    })
    this.deltaSinceLastFrame = this.clock.getDelta()

    const tractor = this.scene.children.find(o => o.name === 'tracteur1.rwx')
    if (tractor && !this.buildMode) {
      tractor.rotation.y += 0.01
      const d = new Vector3()
      tractor.getWorldDirection(d)
      tractor.position.addScaledVector(d, -0.05)
    }

    if (!this.buildMode) {
      this.moveCamera()
    }
    this.moveUsers()
    this.moveLabels()
    this.raycaster.setFromCamera(this.mouse, this.activeCamera)
    this.renderer.render(this.scene, this.activeCamera)
  }

  private resize(): void {
    const width = window.innerWidth
    const height = window.innerHeight
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height)
  }

  private rightClick(event: MouseEvent) {
    event.preventDefault()
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1
    const intersects = this.raycaster.intersectObjects(this.scene.children, true)
    let item = null
    for (const i of intersects) {
      let obj = i.object
      while (obj.parent !== this.scene) {
        obj = obj.parent
      }
      if (obj.name.endsWith('.rwx')) {
        item = obj
        break
      }
    }
    if (item != null) {
      this.select(item as Group)
    }
  }

  private handleKeys(k: string, value: boolean) {
    switch (k) {
      case 'ArrowUp': {
        this.controls[PressedKey.up] = value
        break
      }
      case 'ArrowDown': {
        this.controls[PressedKey.down] = value
        break
      }
      case 'ArrowLeft': {
        this.controls[PressedKey.left] = value
        break
      }
      case 'ArrowRight': {
        this.controls[PressedKey.right] = value
        break
      }
      case 'PageUp': {
        this.controls[PressedKey.pgUp] = value
        break
      }
      case 'PageDown': {
        this.controls[PressedKey.pgDown] = value
        break
      }
      case 'NumpadAdd': {
        this.controls[PressedKey.plus] = value
        break
      }
      case 'NumpadSubtract': {
        this.controls[PressedKey.minus] = value
        break
      }
      case 'ControlLeft': {
        this.controls[PressedKey.ctrl] = value
        break
      }
      case 'ShiftLeft': {
        this.controls[PressedKey.shift] = value
        break
      }
      case 'Escape': {
        this.controls[PressedKey.esc] = value
        break
      }
      default: {
         break
      }
    }
  }

  private moveItem() {
    if (this.controls[PressedKey.esc]) {
      this.buildMode = false
      this.selectedObject = null
      this.selectionBox.geometry.dispose()
      this.scene.remove(this.selectionBox)
      return
    }
    let moveStep = 0.5
    let rotStep = Math.PI / 12
    if (this.controls[PressedKey.shift]) {
      moveStep = 0.05
      rotStep = Math.PI / 120
      if (this.controls[PressedKey.ctrl]) {
        moveStep = 0.01
        rotStep = Math.PI / 180
      }
    }
    const cameraDirection = new Vector3()
    this.activeCamera.getWorldDirection(cameraDirection)
    if (this.controls[PressedKey.plus]) {
      this.selectedObject.translateY(moveStep)
    }
    if (this.controls[PressedKey.minus]) {
      this.selectedObject.translateY(-moveStep)
    }
    const v = new Vector3()
    if (Math.abs(cameraDirection.x) >= Math.abs(cameraDirection.z)) {
      v.x = Math.sign(cameraDirection.x)
    } else {
      v.z = Math.sign(cameraDirection.z)
    }
    if (this.controls[PressedKey.up]) {
      this.selectedObject.position.add(v.multiplyScalar(moveStep))
    }
    if (this.controls[PressedKey.down]) {
      this.selectedObject.position.add(v.multiplyScalar(-moveStep))
    }
    if (this.controls[PressedKey.left]) {
      this.selectedObject.position.add(new Vector3(v.z * moveStep, 0, v.x * -moveStep))
    }
    if (this.controls[PressedKey.right]) {
      this.selectedObject.position.add(new Vector3(v.z * -moveStep, 0, v.x * moveStep))
    }
    if (this.controls[PressedKey.pgUp]) {
      this.selectedObject.rotation.y += rotStep
      if (this.selectedObject.rotation.y > -Math.PI) {
        this.selectedObject.rotation.y -= 2 * Math.PI
      }
    }
    if (this.controls[PressedKey.pgDown]) {
      this.selectedObject.rotation.y -= rotStep
      if (this.selectedObject.rotation.y < -Math.PI) {
        this.selectedObject.rotation.y += 2 * Math.PI
      }
    }
    this.selectionBox.update()
  }


  private moveCamera() {
    const cameraDirection = new Vector3()
    this.activeCamera.getWorldDirection(cameraDirection)
    let steps = 4 * this.deltaSinceLastFrame
    if (this.controls[PressedKey.ctrl]) {
      steps = 16 * this.deltaSinceLastFrame
    }
    if (this.controls[PressedKey.up]) {
      this.player.position.addScaledVector(cameraDirection, steps)
    }
    if (this.controls[PressedKey.down]) {
      this.player.position.addScaledVector(cameraDirection, -steps)
    }
    if (this.controls[PressedKey.left]) {
      if (this.controls[PressedKey.shift]) {
        this.player.position.addScaledVector(new Vector3(cameraDirection.z, 0, -cameraDirection.x), steps)
      } else {
        this.player.rotation.y += 0.1 * steps
        if (this.player.rotation.y > Math.PI) {
         this.player.rotation.y -= 2 * Math.PI
        }
      }
    }
    if (this.controls[PressedKey.right]) {
      if (this.controls[PressedKey.shift]) {
        this.player.position.addScaledVector(new Vector3(-cameraDirection.z, 0, cameraDirection.x), steps)
      } else {
        this.player.rotation.y -= 0.1 * steps
        if (this.player.rotation.y < -Math.PI) {
          this.player.rotation.y += 2 * Math.PI
        }
      }
    }
    if (this.controls[PressedKey.pgUp]) {
      if (this.player.rotation.x < Math.PI / 2) {
        this.player.rotation.x += 0.1 * steps
      }
    }
    if (this.controls[PressedKey.pgDown]) {
      if (this.player.rotation.x > -Math.PI / 2) {
        this.player.rotation.x -= 0.1 * steps
      }
    }
    if (this.controls[PressedKey.plus]) {
      this.player.position.y += steps
    }
    if (this.controls[PressedKey.minus]) {
      this.player.position.y -= steps
    }
    if (this.player.position.y < 0) {
      this.player.position.y = 0
    }
    const sky = this.scene.children.find(o => o.name === 'skybox')
    if (sky != null) {
      sky.position.copy(this.player.position)
    }
    const dirlight = this.scene.children.find(o => o.name === 'dirlight')
    if (dirlight != null) {
      dirlight.position.copy(new Vector3(-50 + this.player.position.x, 80 + this.player.position.y, 10 + this.player.position.z))
    }
    const sph = new Spherical()
    sph.setFromVector3(cameraDirection)
    this.compass.next(Math.round(sph.theta / DEG))
  }

  private moveUsers() {
    for (const u of this.userSvc.userList.filter(usr => usr.completion < 1)) {
      const user = this.scene.children.find(o => o.name === u.id)
      if (user != null) {
        u.completion = (u.completion + this.deltaSinceLastFrame / 0.2) > 1 ? 1 : u.completion + this.deltaSinceLastFrame / 0.2
        user.position.x = u.oldX + (u.x - u.oldX) * u.completion
        user.position.y = u.oldY + (u.y - u.oldY) * u.completion
        if (user.userData.height > 1.1) {
          user.position.y += user.userData.height * 0.55
        }
        user.position.z = u.oldZ + (u.z - u.oldZ) * u.completion
        user.rotation.x = u.oldRoll + (u.roll - u.oldRoll) * u.completion
        user.rotation.y = u.oldYaw + (u.yaw - u.oldYaw) * u.completion + Math.PI
        user.rotation.z = u.oldPitch + (u.pitch - u.oldPitch) * u.completion
      }
    }
  }

  private moveLabels() {
    for (const user of this.scene.children.filter(o => o.userData?.player)) {
      const pos = new Vector3()
      pos.copy(user.position)
      if (user.userData.height > 1.1) {
        pos.y += user.userData.height / 2
      } else {
        pos.y += user.userData.height
      }
      const vector = pos.project(this.activeCamera)
      vector.x = (vector.x + 1)/2 * window.innerWidth
      vector.y = -(vector.y - 1)/2 * window.innerHeight
      const div = document.getElementById('label-' + user.name)
      if (div != null && vector.z < 1) {
        div.style.left = vector.x + 'px'
        div.style.top = vector.y + 'px'
      }
      div.style.visibility = vector.z < 1 ? 'visible' : 'hidden'
    }
  }
}
