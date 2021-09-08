import {BehaviorSubject, fromEvent, Subject, timer} from 'rxjs'
import {Injectable, NgZone} from '@angular/core'
import type {ElementRef} from '@angular/core'
import {
  AmbientLight, Clock, PerspectiveCamera, Raycaster, Scene, Group, BoxBufferGeometry,
  Vector2, Vector3, WebGLRenderer, DirectionalLight, CameraHelper, Object3D, Spherical,
  Mesh, CylinderGeometry, SphereGeometry, MeshBasicMaterial, AxesHelper, EdgesGeometry,
  LineSegments, LineBasicMaterial
} from 'three'
import type {Material, LOD} from 'three'
import {Octree} from 'three/examples/jsm/math/Octree'
import {Capsule} from 'three/examples/jsm/math/Capsule'
import {UserService} from './../user/user.service'
import {ObjectAct, ObjectService} from './../world/object.service'
import {PressedKey, InputSystemService} from './inputsystem.service'
import {config} from '../app.config'
import Utils from '../utils/utils'

export const DEG = Math.PI / 180
export const RPM = Math.PI / 30
const capsuleRadius = 0.35
const xAxis = new Vector3(1, 0, 0)
const yAxis = new Vector3(0, 1, 0)
const zAxis = new Vector3(0, 0, 1)

@Injectable({providedIn: 'root'})
export class EngineService {

  public compassSub: Subject<any> = new Subject()
  public selectedObject: Group
  public selectedObjectSub = new BehaviorSubject<any>({})
  private compass = new Spherical()
  private canvas: HTMLCanvasElement
  private labelZone: HTMLDivElement
  private renderer: WebGLRenderer
  private clock: Clock
  private camera: PerspectiveCamera
  private thirdCamera: PerspectiveCamera
  private activeCamera: PerspectiveCamera
  private lodCamera: PerspectiveCamera
  private player: Object3D
  private scene: Scene
  private light: AmbientLight
  private dirLight: DirectionalLight
  private avatar: Group
  private skybox: Group
  private buildMode = false
  private flyMode = false
  private hoveredObject: Group

  private playerCollider: Capsule
  private worldOctree: Octree
  private capsuleMaterial: MeshBasicMaterial
  private playerVelocity = new Vector3()
  private playerOnFloor = true

  private frameId: number = null
  private deltaSinceLastFrame = 0
  private animationElapsed = 0

  private selectionGroup: Group
  private selectionBox: LineSegments
  private axesHelper: AxesHelper

  private mouse = new Vector2()
  private raycaster = new Raycaster()
  private cameraDirection = new Vector3()

  private usersNode = new Group()
  private worldNode = new Group()
  private objectsNode = new Group()
  private sprites: Set<Group> = new Set()
  private animatedObjects: Set<Group> = new Set()

  private mouseIdle = 0
  private labelDesc: HTMLDivElement
  private localUserPosSub = new Subject<Vector3>()
  private texturesAnimationSub = new Subject<any>()

  private keyActionMap = new Map([
    [PressedKey.up, ObjectAct.forward],
    [PressedKey.right, ObjectAct.right],
    [PressedKey.down, ObjectAct.backward],
    [PressedKey.left, ObjectAct.left],
    [PressedKey.pgUp, ObjectAct.rotY],
    [PressedKey.pgDown, ObjectAct.rotnY],
    [PressedKey.plus, ObjectAct.up],
    [PressedKey.minus, ObjectAct.down],
    [PressedKey.divide, ObjectAct.rotX],
    [PressedKey.multiply, ObjectAct.rotnX],
    [PressedKey.home, ObjectAct.rotZ],
    [PressedKey.end, ObjectAct.rotnZ],
    [PressedKey.esc, ObjectAct.deselect],
    [PressedKey.ins, ObjectAct.copy],
    [PressedKey.del, ObjectAct.delete]
  ])

  public constructor(private ngZone: NgZone, private userSvc: UserService, private inputSysSvc: InputSystemService,
     private objSvc: ObjectService) {
  }

  public cancel(): void {
    if (this.frameId != null) {
      cancelAnimationFrame(this.frameId)
    }
  }

  public localUserPosObservable() {
    return this.localUserPosSub.asObservable()
  }

  public texturesAnimationObservable() {
    return this.texturesAnimationSub.asObservable()
  }

  public createScene(canvas: ElementRef<HTMLCanvasElement>, labelZone: ElementRef<HTMLDivElement>,
                     labelDesc: ElementRef<HTMLDivElement>): void {
    this.canvas = canvas.nativeElement
    this.labelZone = labelZone.nativeElement
    this.labelDesc = labelDesc.nativeElement
    this.labelDesc.innerHTML = ''

    this.renderer = new WebGLRenderer({
      canvas: this.canvas,
      alpha: false,    // transparent background
      antialias: true, // smooth edges
      stencil: false
    })
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.shadowMap.enabled = false

    this.scene = new Scene()

    this.player = new Object3D()
    this.player.rotation.order = 'YXZ'
    this.worldNode.add(this.player)

    this.camera = new PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000)
    this.camera.rotation.order = 'YXZ'
    this.camera.position.y = 0
    this.lodCamera = this.camera.clone()
    this.scene.add(this.lodCamera)
    this.player.attach(this.camera)

    this.thirdCamera = new PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000)
    this.thirdCamera.rotation.order = 'YXZ'
    this.thirdCamera.position.z = 6
    this.thirdCamera.position.y = 0.2
    this.camera.attach(this.thirdCamera)

    this.activeCamera = this.camera

    this.skybox = new Group()
    this.skybox.scale.set(500, 500, 500)
    this.skybox.name = 'skybox'
    this.worldNode.add(this.skybox)

    this.light = new AmbientLight(0x404040)
    this.light.position.z = 100
    this.worldNode.add(this.light)

    // this.scene.fog = new Fog(0xCCCCCC, 10, 50)
    this.worldOctree = new Octree()

    this.dirLight = new DirectionalLight(0xffffff, 0.5)
    this.dirLight.name = 'dirlight'
    this.dirLight.position.set(-50, 80, 10)
    this.dirLight.shadow.camera.left = 100
    this.dirLight.shadow.camera.right = -100
    this.dirLight.shadow.camera.top = 100
    this.dirLight.shadow.camera.bottom = -100
    this.dirLight.shadow.mapSize.width = 2048
    this.dirLight.shadow.mapSize.height = 2048
    this.dirLight.target = this.camera
    this.worldNode.add(this.dirLight)

    this.scene.add(this.worldNode)
    this.scene.add(this.usersNode)
    this.scene.add(this.objectsNode)

    if (config.debug) {
      const shadowHelper = new CameraHelper(this.dirLight.shadow.camera)
      this.scene.add(shadowHelper)
    }
  }

  public clearObjects() {
    if (this.selectionBox != null) {
      this.deselect()
    }
    // Children is a dynamic iterable, we need a copy to get all of them
    for (const item of [...this.objectsNode.children]) {
      this.removeObject(item as Group)
    }
  }

  public clearScene() {
    if (this.selectionBox != null) {
      this.deselect()
    }
    for (const item of [...this.worldNode.children]) {
      this.removeWorldObject(item as Group)
    }
    this.renderer.dispose()
    this.scene.traverse((child: Object3D) => {
      if (child instanceof Mesh) {
        child.geometry.dispose()
      }
      this.disposeMaterial(child as Group)
      if (child.parent) {
        child.parent.remove()
      }
    })
  }

  public updateCapsule() {
    const capsuleHeight = this.camera.position.y * 1.11
    const capsulePos = this.player.position
    this.playerCollider = new Capsule(new Vector3(capsulePos.x, capsulePos.y + capsuleRadius, capsulePos.z),
                                      new Vector3(capsulePos.x, capsulePos.y + capsuleHeight - capsuleRadius, capsulePos.z),
                                      capsuleRadius)
    if (config.debug) {
      for (const item of this.player.children.filter(i => i.name === 'capsule')) {
        this.disposeMaterial(item as Group)
        this.player.remove(item)
      }
      const capsule = new Group()
      capsule.name = 'capsule'
      const cylinderGeometry = new CylinderGeometry(capsuleRadius, capsuleRadius, capsuleHeight - capsuleRadius * 2, 8)
      const topSphereGeometry = new SphereGeometry(capsuleRadius, 8, 8, Math.PI / 2, Math.PI)
      const bottomSphereGeometry = new SphereGeometry(capsuleRadius, 8, 8, Math.PI / 2, Math.PI)
      topSphereGeometry.clearGroups()
      topSphereGeometry.addGroup(0, topSphereGeometry.getIndex().count, 0)
      topSphereGeometry.rotateZ(Math.PI / 2)
      bottomSphereGeometry.clearGroups()
      bottomSphereGeometry.addGroup(0, bottomSphereGeometry.getIndex().count, 0)
      bottomSphereGeometry.rotateZ(-Math.PI / 2)
      this.capsuleMaterial = new MeshBasicMaterial({color: 0x00ff00, wireframe: true})
      const cylinder = new Mesh(cylinderGeometry, [this.capsuleMaterial])
      const topSphere = new Mesh(topSphereGeometry, [this.capsuleMaterial])
      const bottomSphere = new Mesh(bottomSphereGeometry, [this.capsuleMaterial])
      cylinder.position.set(0, capsuleHeight / 2, 0)
      topSphere.position.set(0, capsuleHeight - capsuleRadius, 0)
      bottomSphere.position.set(0, capsuleRadius, 0)
      capsule.add(cylinder)
      capsule.add(topSphere)
      capsule.add(bottomSphere)
      capsule.position.set(capsulePos.x, capsulePos.y, capsulePos.z)
      this.player.attach(capsule)
    }
  }

  public createTextLabel(group: Group) {
    // avoid duplicate labels
    const oldLabel = document.getElementById('label-' + group.name)
    if (oldLabel != null) {
      oldLabel.remove()
    }
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

  public attachCam(group: Group) {
    this.avatar = group
    this.avatar.visible = this.activeCamera === this.thirdCamera
    this.player.attach(this.avatar)
  }

  public setCameraOffset(offset: number) {
    this.camera.position.y = offset
    this.avatar.position.y = this.player.position.y + this.avatar.userData.offsetY
  }

  public refreshOctree(withObjects = false) {
    this.worldOctree = new Octree()
    this.worldOctree.fromGraphNode(this.worldNode.children.find(o => o.name === 'terrain'))
    if (withObjects) {
      for (const item of this.objectsNode.children.filter(i => i.name.endsWith('.rwx') && i.userData.notSolid !== true)) {
        this.addMeshToOctree(item as Group)
      }
    }
  }

  public addChunk(chunk: LOD) {
    chunk.matrixAutoUpdate = false
    this.objectsNode.add(chunk)

    for (const child of chunk.levels[0].object.children) {
      this.handleSpecialObject(child as Group)
    }

    chunk.updateMatrix()
  }

  public setChunksDistance(meters: number) {
    for (const chunk of this.objectsNode.children as LOD[]) {
      chunk.levels[0].distance = meters
      chunk.levels[1].distance = meters + 1
    }
  }

  public addWorldObject(group: Group) {
    this.worldNode.add(group)
  }

  public addUser(group: Group) {
    this.usersNode.add(group)
  }

  public addMeshToOctree(group: Group) {
    if (group.userData.notSolid !== true) {
      setTimeout(() => this.worldOctree.fromGraphNode(group),
        100 * Math.sqrt((group.position.x - this.player.position.x) ** 2 + (group.position.z - this.player.position.z) ** 2)
      )
    }
  }

  public setSkybox(skybox: Group) {
    this.skybox.clear()
    this.skybox.add(skybox)
  }

  public disposeMaterial(group: Group) {
    group.traverse((child: Object3D) => {
      if (child instanceof Mesh) {
        for (const m of child.material) {
          if (m.alphaMap != null) {
            m.alphaMap.dispose()
          }
          if (m.map != null) {
            m.map.dispose()
          }
          m.dispose()
        }
      }
    })
  }

  public removeObject(group: Group) {
    if (group === this.selectedObject) {
      this.deselect()
    }
    if (group.userData.rwx?.axisAlignment !== 'none') {
      this.sprites.delete(group)
    }
    if (group.userData.rotate != null || group.userData.move != null) {
      this.animatedObjects.delete(group)
    }
    this.disposeMaterial(group)
    group.traverse((child: Object3D) => {
      if (child instanceof Mesh) {
        child.geometry.dispose()
      }
    })
    group.parent.remove(group)
  }

  public removeWorldObject(group: Group) {
    if (group) {
      this.disposeMaterial(group)
      group.traverse((child: Object3D) => {
        if (child instanceof Mesh) {
          child.geometry.dispose()
        }
      })
      group.parent.remove(group)
    }
  }

  public removeUser(group: Group) {
    const divUser = document.getElementById('label-' + group.name)
    if (divUser) {
      divUser.remove()
    }
    this.disposeMaterial(group)
    group.traverse((child: Object3D) => {
      if (child instanceof Mesh) {
        child.geometry.dispose()
      }
    })
    this.usersNode.remove(group)
  }

  public users() {
    return this.usersNode.children
  }

  public animate(): void {
    // We have to run this outside angular zones,
    // because it could trigger heavy changeDetection cycles.
    this.ngZone.runOutsideAngular(() => {
      this.clock = new Clock(true)
      if (document.readyState !== 'loading') {
        this.render()
      } else {
        fromEvent(window, 'DOMContentLoaded').subscribe(() => this.render())
      }
      fromEvent(window, 'resize').subscribe(() => this.resize())
      fromEvent(this.canvas, 'contextmenu').subscribe((e: MouseEvent) => this.rightClick(e))
      fromEvent(this.canvas, 'mousemove').subscribe((e: MouseEvent) => {
        this.mouseIdle = 0
        this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1
        this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1
      })
      fromEvent(this.canvas, 'mousedown').subscribe((e: MouseEvent) => {
        if (e.button === 0 && this.selectionBox != null) {
          this.deselect()
        }
      })
      this.inputSysSvc.keyDownEvent.subscribe((k) => {
        // reset tooltip
        this.mouseIdle = 0
        this.labelDesc.style.display = 'none'
        this.hoveredObject = null
        if (this.buildMode) {
          const act = this.keyActionMap.get(k) || ObjectAct.nop
          this.objSvc.objectAction.next(act)
        }
      })
      this.inputSysSvc.keyUpEvent.subscribe(() => {
        this.mouseIdle = 0
      })
      this.objSvc.objectAction.subscribe((act) => {
        if (this.buildMode) {
          this.moveItem(act)
        }
      })
      timer(0, 100).subscribe(() => {
        this.mouseIdle++
        if (this.mouseIdle >= 10) {
          const item = this.pointedItem()
          if (item !== this.hoveredObject) {
            this.labelDesc.style.display = 'none'
            this.hoveredObject = item
            if (item != null && item.userData?.desc) {
              this.labelDesc.style.display = 'block'
              this.labelDesc.innerHTML = item.userData.desc
              this.labelDesc.style.left = (this.mouse.x + 1) / 2 * window.innerWidth + 'px'
              this.labelDesc.style.top = -(this.mouse.y - 1) / 2 * window.innerHeight + 'px'
            }
          }
          this.mouseIdle = 5
        }
      })
    })
  }

  public toggleCamera() {
    this.activeCamera = this.activeCamera === this.camera ? this.thirdCamera : this.camera
    this.avatar.visible = this.activeCamera === this.thirdCamera
  }

  public teleport(pos: Vector3 | string): void {
    if (typeof pos === 'string') {
      pos = Utils.stringToPos(pos)
    }
    this.player.position.copy(pos)
    this.updateCapsule()
  }

  public getLODs(): LOD[] {
    return this.objectsNode.children as LOD[]
  }

  public updateSelectionBox(): void {
    this.selectedObject.updateMatrix()
    const chunkData = this.selectedObject.parent.userData.world.chunk
    const center = new Vector3(this.selectedObject.userData.boxCenter.x,
                               this.selectedObject.userData.boxCenter.y,
                               this.selectedObject.userData.boxCenter.z)
    this.selectionBox.position.copy(center)
    center.applyAxisAngle(yAxis, this.selectedObject.rotation.y)
    center.applyAxisAngle(zAxis, this.selectedObject.rotation.z)
    center.applyAxisAngle(xAxis, this.selectedObject.rotation.x)
    this.selectionGroup.position.copy(new Vector3(chunkData.x + this.selectedObject.position.x,
                                                  this.selectedObject.position.y,
                                                  chunkData.z + this.selectedObject.position.z))
    this.selectionGroup.rotation.copy(this.selectedObject.rotation)
    this.selectionGroup.updateMatrix()
  }

  private handleSpecialObject(group: Group) {
    if (group.userData.rwx?.axisAlignment !== 'none') {
      this.sprites.add(group)
    }
    if (group.userData.rotate != null || group.userData.move != null) {
      this.animatedObjects.add(group)
    }
  }

  private updateLODs() {
    // We trick the LOD into acting like the camera is always on the ground,
    // this avoids having chunks disappearing if we get to high/far on the Y axis
    this.lodCamera.position.set(this.player.position.x, 0, this.player.position.z)
    this.lodCamera.rotation.copy(this.player.rotation)
    this.lodCamera.updateMatrix()
    this.lodCamera.updateProjectionMatrix()

    for (const lod of this.objectsNode.children as LOD[]) {
      lod.update(this.lodCamera)
    }
  }

  private render(): void {
    this.frameId = requestAnimationFrame(() => {
      this.render()
    })
    this.deltaSinceLastFrame = this.clock.getDelta()
    this.activeCamera.getWorldDirection(this.cameraDirection)

    if (this.animationElapsed > 0.10) {
      this.texturesAnimationSub.next(null)
      this.animationElapsed = 0
    } else {
      this.animationElapsed += this.deltaSinceLastFrame
    }

    if (!this.buildMode) {
      this.moveCamera()
      this.animateItems()
    }

    this.updateLODs()
    this.moveUsers()
    this.moveLabels()
    this.renderer.render(this.scene, this.activeCamera)
  }

  private resize(): void {
    const width = window.innerWidth
    const height = window.innerHeight
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height)
  }

  private deselect() {
    this.buildMode = false
    this.selectedObject = null
    this.selectedObjectSub.next({})
    this.selectionBox.geometry.dispose()
    ;(this.selectionBox.material as Material).dispose()
    this.axesHelper.dispose()
    this.scene.remove(this.selectionGroup)
    this.selectionBox = null
    this.axesHelper = null
    this.selectionGroup = null
  }

  private select(item: Group) {
    if (this.selectionBox != null) {
      this.deselect()
    }
    this.buildMode = true
    this.selectedObject = item
    this.selectedObjectSub.next({name: item.name, desc: item.userData.desc, act: item.userData.act, date: item.userData.date})
    console.log(item)

    const geometry = new BoxBufferGeometry(item.userData.box.x, item.userData.box.y, item.userData.box.z)
    const edges = new EdgesGeometry(geometry)
    this.selectionGroup = new Group()
    this.selectionBox = new LineSegments(edges, new LineBasicMaterial({color: 0xffff00, depthTest: false}))
    this.axesHelper = new AxesHelper(5)
    ;(this.axesHelper.material as Material).depthTest = false
    this.selectionGroup.add(this.selectionBox, this.axesHelper)

    this.updateSelectionBox()

    this.scene.add(this.selectionGroup)
  }

  private pointedItem() {
    this.raycaster.setFromCamera(this.mouse, this.activeCamera)
    const intersects = this.raycaster.intersectObjects(this.objectsNode.children, true)
    let item = null
    for (const i of intersects) {
      let obj = i.object
      while (!obj.parent.userData.world?.chunk) {
        obj = obj.parent
      }
      if (obj.name.endsWith('.rwx')) {
        item = obj
        break
      }
    }
    return item
  }

  private rightClick(event: MouseEvent) {
    event.preventDefault()
    const item = this.pointedItem()
    if (item != null) {
      this.select(item as Group)
    }
  }

  private moveItem(action: ObjectAct) {
    if (action === ObjectAct.deselect) {
      this.deselect()
      return
    }
    const allowRotation = this.selectedObject.userData.rwx?.axisAlignment === 'none'
    let moveStep = 0.5
    let rotStep = Math.PI / 12
    if (this.inputSysSvc.controls[PressedKey.shift]) {
      moveStep = 0.05
      rotStep = Math.PI / 120
      if (this.inputSysSvc.controls[PressedKey.ctrl]) {
        moveStep = 0.01
        rotStep = Math.PI / 180
      }
    }
    const v = new Vector3()
    if (Math.abs(this.cameraDirection.x) >= Math.abs(this.cameraDirection.z)) {
      v.x = Math.sign(this.cameraDirection.x)
    } else {
      v.z = Math.sign(this.cameraDirection.z)
    }
    switch (action) {
      case (ObjectAct.up): {
        this.selectedObject.translateY(moveStep)
        this.updateSelectionBox()
        break
      }
      case (ObjectAct.down): {
        this.selectedObject.translateY(-moveStep)
        this.updateSelectionBox()
        break
      }
      case (ObjectAct.forward): {
        this.selectedObject.position.add(v.multiplyScalar(moveStep))
        this.updateSelectionBox()
        break
      }
      case (ObjectAct.backward): {
        this.selectedObject.position.add(v.multiplyScalar(-moveStep))
        this.updateSelectionBox()
        break
      }
      case (ObjectAct.left): {
        this.selectedObject.position.add(new Vector3(v.z * moveStep, 0, v.x * -moveStep))
        this.updateSelectionBox()
        break
      }
      case (ObjectAct.right): {
        this.selectedObject.position.add(new Vector3(v.z * -moveStep, 0, v.x * moveStep))
        this.updateSelectionBox()
        break
      }
      case (ObjectAct.rotY): {
        if (allowRotation) {
          this.selectedObject.rotateOnAxis(yAxis, rotStep)
          this.updateSelectionBox()
        }
        break
      }
      case (ObjectAct.rotnY): {
        if (allowRotation) {
          this.selectedObject.rotateOnAxis(yAxis, -rotStep)
          this.updateSelectionBox()
        }
        break
      }
      case (ObjectAct.rotX): {
        if (allowRotation) {
          this.selectedObject.rotateOnAxis(xAxis, rotStep)
          this.updateSelectionBox()
        }
        break
      }
      case (ObjectAct.rotnX): {
        if (allowRotation) {
          this.selectedObject.rotateOnAxis(xAxis, -rotStep)
          this.updateSelectionBox()
        }
        break
      }
      case (ObjectAct.rotZ): {
        if (allowRotation) {
          this.selectedObject.rotateOnAxis(zAxis, rotStep)
          this.updateSelectionBox()
        }
        break
      }
      case (ObjectAct.rotnZ): {
        if (allowRotation) {
          this.selectedObject.rotateOnAxis(zAxis, -rotStep)
          this.updateSelectionBox()
        }
        break
      }
      case (ObjectAct.snapGrid): {
        this.selectedObject.position.set(Math.round(this.selectedObject.position.x * 2) / 2,
                                         Math.round(this.selectedObject.position.y * 2) / 2,
                                         Math.round(this.selectedObject.position.z * 2) / 2)
        this.updateSelectionBox()
        break
      }
      case (ObjectAct.rotReset): {
        if (allowRotation) {
          this.selectedObject.rotation.set(0, 0, 0)
          this.updateSelectionBox()
        }
        break
      }
      case (ObjectAct.copy): {
        const parent = this.selectedObject.parent
        this.selectedObject = this.selectedObject.clone()
        this.selectedObject.position.add(v.multiplyScalar(moveStep))
        parent.add(this.selectedObject)
        this.updateSelectionBox()
        break
      }
      case (ObjectAct.delete): {
        this.removeObject(this.selectedObject)
        return
      }
      default:
        return
    }
  }

  private moveCamera() {
    let steps = 0
    if (!this.flyMode) {
      steps = 3 * this.deltaSinceLastFrame
      if (this.inputSysSvc.controls[PressedKey.ctrl]) {
        steps = 9 * this.deltaSinceLastFrame
      }
    } else {
      steps = 12 * this.deltaSinceLastFrame
      if (this.inputSysSvc.controls[PressedKey.ctrl]) {
        steps = 30 * this.deltaSinceLastFrame
      }
    }
    if (this.inputSysSvc.controls[PressedKey.up]) {
      this.playerVelocity.add(new Vector3(this.cameraDirection.x, 0, this.cameraDirection.z).multiplyScalar(steps))
    }
    if (this.inputSysSvc.controls[PressedKey.down]) {
      this.playerVelocity.add(new Vector3(-this.cameraDirection.x, 0, -this.cameraDirection.z).multiplyScalar(steps))
    }
    if (this.inputSysSvc.controls[PressedKey.left]) {
      if (this.inputSysSvc.controls[PressedKey.shift]) {
        this.playerVelocity.add(new Vector3(this.cameraDirection.z, 0, -this.cameraDirection.x).multiplyScalar(steps))
      } else {
        this.player.rotation.y += 0.1 * steps
        this.player.rotation.y = this.radNormalized(this.player.rotation.y)
      }
    }
    if (this.inputSysSvc.controls[PressedKey.right]) {
      if (this.inputSysSvc.controls[PressedKey.shift]) {
        this.playerVelocity.add(new Vector3(-this.cameraDirection.z, 0, this.cameraDirection.x).multiplyScalar(steps))
      } else {
        this.player.rotation.y -= 0.1 * steps
        this.player.rotation.y = this.radNormalized(this.player.rotation.y)
      }
    }
    if (this.inputSysSvc.controls[PressedKey.pgUp]) {
      if (this.player.rotation.x < Math.PI / 2) {
        this.player.rotation.x += 0.1 * steps
      }
    }
    if (this.inputSysSvc.controls[PressedKey.pgDown]) {
      if (this.player.rotation.x > -Math.PI / 2) {
        this.player.rotation.x -= 0.1 * steps
      }
    }
    if (this.inputSysSvc.controls[PressedKey.plus]) {
      this.flyMode = true
      this.playerVelocity.add(new Vector3(0, 1, 0).multiplyScalar(steps))
    }
    if (this.inputSysSvc.controls[PressedKey.minus]) {
      this.flyMode = true
      this.playerVelocity.add(new Vector3(0, 1, 0).multiplyScalar(-steps))
    }
    const damping = Math.exp(-3 * this.deltaSinceLastFrame) - 1
    if (this.playerOnFloor) {
      this.playerVelocity.addScaledVector(this.playerVelocity, damping)
    } else {
      if (!this.flyMode && !this.inputSysSvc.controls[PressedKey.shift]) {
        this.playerVelocity.y -= 30 * this.deltaSinceLastFrame
      } else {
        this.playerVelocity.addScaledVector(this.playerVelocity, damping)
      }
    }

    if (this.playerCollider) {
      const deltaPosition = this.playerVelocity.clone().multiplyScalar(this.deltaSinceLastFrame)
      this.playerCollider.translate(deltaPosition)
      const result = this.worldOctree.capsuleIntersect(this.playerCollider)
      this.playerOnFloor = false
      if (result && !this.inputSysSvc.controls[PressedKey.shift]) {
        if (config.debug) {
          this.capsuleMaterial.color.setHex(0xff0000)
        }
        this.playerOnFloor = result.normal.y > 0
        if (!this.playerOnFloor) {
          this.playerVelocity.addScaledVector(result.normal, - result.normal.dot(this.playerVelocity))
        } else {
          this.flyMode = false
        }
        this.playerCollider.translate(result.normal.multiplyScalar(result.depth))
      } else {
        if (config.debug) {
          this.capsuleMaterial.color.setHex(0x00ff00)
        }
      }

      this.player.position.set(this.playerCollider.start.x, this.playerCollider.start.y - capsuleRadius, this.playerCollider.start.z)
      this.localUserPosSub.next(this.player.position)
    }

    for (const item of this.sprites) {
      item.rotation.y = this.player.rotation.y
      item.updateMatrix()
    }

    this.skybox.position.copy(this.player.position)
    this.dirLight.position.set(-50 + this.player.position.x, 80 + this.player.position.y, 10 + this.player.position.z)

    // compass
    this.compass.setFromVector3(this.cameraDirection)
    this.compassSub.next(Math.round(this.compass.theta / DEG))
  }

  private animateItems() {
    for (const item of this.animatedObjects) {
      if (item.userData.move) {
        if (item.userData.move.waiting > 0) {
          item.userData.move.waiting -= this.deltaSinceLastFrame
        } else if (item.userData.move.completion < 1) {
          item.position.x += (item.userData.move.distance.x / item.userData.move.time)
            * this.deltaSinceLastFrame * item.userData.move.direction
          item.position.y += (item.userData.move.distance.y / item.userData.move.time)
            * this.deltaSinceLastFrame * item.userData.move.direction
          item.position.z += (item.userData.move.distance.z / item.userData.move.time)
            * this.deltaSinceLastFrame * item.userData.move.direction
          item.userData.move.completion += this.deltaSinceLastFrame / item.userData.move.time
        } else {
          // move is done
          if (item.userData.move.direction === -1) {
            // wayback is done
            if (item.userData.move.loop) {
              item.userData.move.direction = item.userData.move.direction * -1
              item.userData.move.completion = 0
            }
          } else {
            if (item.userData.move.reset) {
              // no wayback, all done
              item.position.copy(item.userData.move.orig)
              if (item.userData.move.loop) {
                // loop
                item.userData.move.completion = 0
              }
            } else {
              item.userData.move.waiting = item.userData.move.wait
              // wayback is starting
              item.userData.move.direction = item.userData.move.direction * -1
              item.userData.move.completion = 0
            }
          }
        }
      }
      if (item.userData.rotate) {
        if (item.userData.rotate.waiting > 0) {
          item.userData.rotate.waiting -= this.deltaSinceLastFrame
        } else {
          item.rotateOnAxis(yAxis, item.userData.rotate.speed.y * RPM * this.deltaSinceLastFrame * item.userData.rotate.direction)
          item.rotateOnAxis(zAxis, item.userData.rotate.speed.z * RPM * this.deltaSinceLastFrame * item.userData.rotate.direction)
          item.rotateOnAxis(xAxis, item.userData.rotate.speed.x * RPM * this.deltaSinceLastFrame * item.userData.rotate.direction)
          if (item.userData.rotate.time) {
            if (item.userData.rotate.completion >= 1) {
              if (item.userData.rotate.loop) {
                item.userData.rotate.completion = 0
                if (item.userData.rotate.reset) {
                  item.rotation.copy(item.userData.rotate.orig)
                } else {
                  item.userData.rotate.waiting = item.userData.rotate.wait
                  item.userData.rotate.direction = item.userData.rotate.direction * -1
                }
              }
            }
            item.userData.rotate.completion += this.deltaSinceLastFrame / item.userData.rotate.time
          }
        }
      }
      item.updateMatrix()
    }
  }

  private moveUsers() {
    for (const u of this.userSvc.userList.filter(usr => usr.completion < 1)) {
      const user = this.usersNode.children.find(o => o.name === u.id)
      if (user != null) {
        u.completion = (u.completion + this.deltaSinceLastFrame / 0.2) > 1 ? 1 : u.completion + this.deltaSinceLastFrame / 0.2
        user.position.x = u.oldX + (u.x - u.oldX) * u.completion
        user.position.y = u.oldY + (u.y - u.oldY) * u.completion
        user.position.y += user.userData.offsetY
        user.position.z = u.oldZ + (u.z - u.oldZ) * u.completion
        user.rotation.x = u.oldRoll + (u.roll - u.oldRoll) * u.completion
        user.rotation.y = u.oldYaw + (u.yaw - u.oldYaw) * u.completion + Math.PI
        user.rotation.z = u.oldPitch + (u.pitch - u.oldPitch) * u.completion
      }
    }
  }

  private moveLabels() {
    for (const user of this.usersNode.children) {
      const pos = user.position.clone()
      if (user.userData.height > 1.1) {
        pos.y += user.userData.height / 2
      } else {
        pos.y += user.userData.height
      }
      const vector = pos.project(this.activeCamera)
      vector.x = (vector.x + 1) / 2 * window.innerWidth
      vector.y = -(vector.y - 1) / 2 * window.innerHeight
      const div = document.getElementById('label-' + user.name)
      if (div != null) {
        if (vector.z < 1) {
          div.style.left = vector.x + 'px'
          div.style.top = vector.y + 'px'
        }
        div.style.visibility = vector.z < 1 ? 'visible' : 'hidden'
      }
    }
  }

  private radNormalized(value: number): number {
    if (value > Math.PI) {
      value -= 2 * Math.PI
    } else if (value < -Math.PI) {
      value += 2 * Math.PI
    }
    return value
  }
}
