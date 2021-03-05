import {ElementRef, Injectable, NgZone, OnDestroy} from '@angular/core'
import {
  AmbientLight, BoxGeometry, Clock, EdgesGeometry, LineBasicMaterial, LineSegments, Mesh,
  MeshBasicMaterial, PerspectiveCamera, Raycaster, Scene,
  Vector2, Vector3, WebGLRenderer, DirectionalLight, PCFSoftShadowMap, CameraHelper
} from 'three'

import {UserService} from './../user/user.service'
import {config} from '../app.config'

export const enum PressedKey { up = 0, right, down, left, pgUp, pgDown, plus, minus, ctrl, shift }

@Injectable({providedIn: 'root'})
export class EngineService implements OnDestroy {

  private canvas: HTMLCanvasElement
  private labelZone: HTMLDivElement
  private renderer: WebGLRenderer
  private clock: Clock
  private camera: PerspectiveCamera
  private thirdCamera: PerspectiveCamera
  private activeCamera: PerspectiveCamera
  private scene: Scene
  private light: AmbientLight
  private dirLight: DirectionalLight

  private frameId: number = null
  private deltaSinceLastFrame = 0

  private selectionBox: LineSegments
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

    this.camera = new PerspectiveCamera(
      75, window.innerWidth / window.innerHeight, 0.1, 1000
    )
    this.camera.rotation.order = 'YXZ'
    this.camera.position.z = 0
    this.camera.position.y = 0.2
    this.scene.add(this.camera)

    this.thirdCamera = new PerspectiveCamera(
      75, window.innerWidth / window.innerHeight, 0.1, 1000
    )
    this.thirdCamera.rotation.order = 'YXZ'
    this.thirdCamera.position.z = 0.5
    this.thirdCamera.position.y = 0.2
    this.camera.attach(this.thirdCamera)

    this.activeCamera = this.camera

    this.light = new AmbientLight(0x404040)
    this.light.position.z = 10
    this.scene.add(this.light)

    this.dirLight = new DirectionalLight(0x10100f, 10)
    this.dirLight.position.set(50, 100, 50)
    this.dirLight.castShadow = true
    this.dirLight.shadow.mapSize.width = 2048
    this.dirLight.shadow.mapSize.height = 2048
    this.dirLight.target = this.camera
    this.scene.add(this.dirLight)

    if (config.debug) {
      const shadowHelper = new CameraHelper(this.dirLight.shadow.camera)
      this.scene.add(shadowHelper)
    }
  }

  public createTextLabel(mesh: Mesh) {
    const div = document.createElement('div')
    div.className = 'text-label'
    div.id = 'label-' + mesh.name
    div.style.position = 'absolute'
    div.style.transform = 'translate(-50%, -100%)'
    const user = this.userSvc.userList.find(u => u.id === mesh.name)
    div.innerHTML = user ? user.name : ''
    this.labelZone.appendChild(div)
  }

  public getPosition(): [Vector3, Vector3] {
    const p = this.camera.position.clone()
    p.y -= 0.09
    const o = this.camera.rotation.toVector3()
    return [p, o]
  }

  public setBackground(bg) {
    this.scene.background = bg
  }

  public attachCam(mesh: Mesh) {
    this.camera.attach(mesh)
  }

  public addMesh(mesh: Mesh) {
    this.scene.add(mesh)
  }

  public removeMesh(mesh: Mesh) {
    this.scene.remove(mesh)
  }

  public objects() {
    return this.scene.children
  }

  public select(item: Mesh) {
    if (this.selectionBox == null) {
      const selectMesh = new Mesh(new BoxGeometry(1, 1, 1),
      new MeshBasicMaterial())
      selectMesh.matrixAutoUpdate = false
      selectMesh.visible = false

      const geometry = item.geometry

      if ( geometry.boundingBox === null ) {
        geometry.computeBoundingBox()
      }

      selectMesh.geometry.vertices[0].y = geometry.boundingBox.max.y
      selectMesh.geometry.vertices[0].z = geometry.boundingBox.max.z
      selectMesh.geometry.vertices[1].x = geometry.boundingBox.max.x
      selectMesh.geometry.vertices[1].y = geometry.boundingBox.max.y
      selectMesh.geometry.vertices[1].z = geometry.boundingBox.min.z
      selectMesh.geometry.vertices[2].x = geometry.boundingBox.max.x
      selectMesh.geometry.vertices[2].y = geometry.boundingBox.min.y
      selectMesh.geometry.vertices[2].z = geometry.boundingBox.max.z
      selectMesh.geometry.vertices[3].x = geometry.boundingBox.max.x
      selectMesh.geometry.vertices[3].y = geometry.boundingBox.min.y
      selectMesh.geometry.vertices[3].z = geometry.boundingBox.min.z
      selectMesh.geometry.vertices[4].x = geometry.boundingBox.min.x
      selectMesh.geometry.vertices[4].y = geometry.boundingBox.max.y
      selectMesh.geometry.vertices[0].x = geometry.boundingBox.max.x
      selectMesh.geometry.vertices[4].z = geometry.boundingBox.min.z
      selectMesh.geometry.vertices[5].x = geometry.boundingBox.min.x
      selectMesh.geometry.vertices[5].y = geometry.boundingBox.max.y
      selectMesh.geometry.vertices[5].z = geometry.boundingBox.max.z
      selectMesh.geometry.vertices[6].x = geometry.boundingBox.min.x
      selectMesh.geometry.vertices[6].y = geometry.boundingBox.min.y
      selectMesh.geometry.vertices[6].z = geometry.boundingBox.min.z
      selectMesh.geometry.vertices[7].x = geometry.boundingBox.min.x
      selectMesh.geometry.vertices[7].y = geometry.boundingBox.min.y
      selectMesh.geometry.vertices[7].z = geometry.boundingBox.max.z
      selectMesh.geometry.computeBoundingSphere()
      selectMesh.geometry.verticesNeedUpdate = true
      selectMesh.matrixWorld.copy(item.matrixWorld)

      const edges = new EdgesGeometry(selectMesh.geometry)

      selectMesh.geometry.dispose()
      selectMesh.material.dispose()

      this.selectionBox = new LineSegments(edges, new LineBasicMaterial( { color: 0xffff00, depthTest: false } ))
      edges.dispose()
      item.add(this.selectionBox)

    } else {
      this.selectionBox.visible = false
      this.selectionBox.geometry.dispose()
      this.scene.remove(this.selectionBox)
      this.selectionBox = null
    }
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
      this.canvas.addEventListener('contextmenu', (e) => {
        this.rightClick(e)
      })
      window.addEventListener('keydown', (e: KeyboardEvent) => {
        if ((e.target as HTMLElement).nodeName === 'BODY') {
          this.handleKeys(e.key, true)
          e.preventDefault()
        }
      })
      window.addEventListener('keyup', (e: KeyboardEvent) => {
        if ((e.target as HTMLElement).nodeName === 'BODY') {
          this.handleKeys(e.key, false)
          e.preventDefault()
        }
      })
    })
  }

  public toggleCamera() {
    this.activeCamera = this.activeCamera === this.camera ? this.thirdCamera : this.camera
  }

  private render(): void {
    this.frameId = requestAnimationFrame(() => {
      this.render()
    })
    this.deltaSinceLastFrame = this.clock.getDelta()

    const tractor = this.scene.children.find(o => o.name === 'tracteur1.rwx')
    if (tractor) {
      tractor.rotation.y += 0.01
      const d = new Vector3()
      tractor.getWorldDirection(d)
      tractor.position.addScaledVector(d, -0.005)
    }

    this.moveCamera()
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

  private rightClick(event) {
    event.preventDefault()

    this.mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1
    this.mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1
    const intersects = this.raycaster.intersectObjects(this.scene.children)
    for (const o of intersects) {
      if (o.object.name.length) {
        this.select(o.object as Mesh)
      }
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
      case '+': {
        this.controls[PressedKey.plus] = value
        break
      }
      case '-': {
        this.controls[PressedKey.minus] = value
        break
      }
      case 'Control': {
        this.controls[PressedKey.ctrl] = value
        break
      }
      case 'Shift': {
        this.controls[PressedKey.shift] = value
        break
      }
      default: {
         break
      }
    }
  }

  private moveCamera() {
    const cameraDirection = new Vector3()
    this.camera.getWorldDirection(cameraDirection)
    if (this.controls[PressedKey.up]) {
      this.camera.position.addScaledVector(cameraDirection, 0.1)
    }
    if (this.controls[PressedKey.down]) {
      this.camera.position.addScaledVector(cameraDirection, -0.1)
    }
    if (this.controls[PressedKey.left]) {
      this.camera.rotation.y += 0.1
      if (this.camera.rotation.y > Math.PI) {
        this.camera.rotation.y -= 2 * Math.PI
      }
    }
    if (this.controls[PressedKey.right]) {
      this.camera.rotation.y -= 0.1
      if (this.camera.rotation.y < -Math.PI) {
        this.camera.rotation.y += 2 * Math.PI
      }
    }
    if (this.controls[PressedKey.pgUp]) {
      if (this.camera.rotation.x < Math.PI / 2) {
        this.camera.rotation.x += 0.1
      }
    }
    if (this.controls[PressedKey.pgDown]) {
      if (this.camera.rotation.x > -Math.PI / 2) {
        this.camera.rotation.x -= 0.1
      }
    }
    if (this.controls[PressedKey.plus]) {
      this.camera.position.y += 0.1
    }
    if (this.controls[PressedKey.minus]) {
      this.camera.position.y -= 0.1
    }
    const sky = this.scene.children.find(o => o.name === 'skybox')
    if (sky != null) {
      sky.position.copy(this.camera.position)
    }
  }

  private moveUsers() {
    for (const u of this.userSvc.userList.filter(usr => usr.completion < 1)) {
      const user = this.scene.children.find(o => o.name === u.id)
      if (user != null) {
        u.completion = (u.completion + this.deltaSinceLastFrame / 0.2) > 1 ? 1 : u.completion + this.deltaSinceLastFrame / 0.2
        user.position.x = u.oldX + (u.x - u.oldX) * u.completion
        user.position.y = u.oldY + (u.y - u.oldY) * u.completion
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
      pos.y += 0.11
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
