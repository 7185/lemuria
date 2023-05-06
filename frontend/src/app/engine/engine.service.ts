import {BehaviorSubject, fromEvent, Subject, timer} from 'rxjs'
import {Injectable, NgZone, signal} from '@angular/core'
import type {ElementRef} from '@angular/core'
import {
  AmbientLight,
  Cache,
  Clock,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Group,
  BoxGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
  DirectionalLight,
  CameraHelper,
  Object3D,
  Spherical,
  Mesh,
  MeshBasicMaterial,
  AxesHelper,
  EdgesGeometry,
  LineSegments,
  LineBasicMaterial,
  SRGBColorSpace,
  Color
} from 'three'
import type {Box3, Material, LOD, Triangle} from 'three'
import {TeleportService} from './teleport.service'
import {UserService} from '../user'
import {ObjectAct, ObjectService} from '../world/object.service'
import type {AvatarAnimationPlayer} from '../animation'
import {PressedKey, InputSystemService} from './inputsystem.service'
import {config} from '../app.config'
import {PlayerCollider} from './player-collider'
import {Utils} from '../utils'

export const DEG = Math.PI / 180
export const RPM = Math.PI / 30
const xAxis = new Vector3(1, 0, 0)
const yAxis = new Vector3(0, 1, 0)
const zAxis = new Vector3(0, 0, 1)
const playerBoxSide = config.world.collider.boxSide
const playerClimbHeight = config.world.collider.climbHeight
const playerGroundAdjust = config.world.collider.groundAdjust
const playerMaxStepLength = config.world.collider.maxStepLength
const playerMaxNbSteps = config.world.collider.maxNbSteps
const chunkIndexStep = 100000

// This defines which chunks (offset from the current chunk we sit in) we will
// query for collisions for each player movement step
const nearestChunkPattern = [
  {x: -1, z: -1},
  {x: -1, z: 0},
  {x: -1, z: 1},
  {x: 0, z: -1},
  {x: 0, z: 0},
  {x: 0, z: 1},
  {x: 1, z: -1},
  {x: 1, z: 0},
  {x: 1, z: 1}
]

@Injectable({providedIn: 'root'})
export class EngineService {
  public compassSub: Subject<any> = new Subject()
  public fpsSub = new BehaviorSubject<string>('0')
  public maxFps = signal(60)
  public selectedObject: Group
  public selectedObjectSignal = signal({})
  private chunkMap = new Map<number, LOD>()
  private compass = new Spherical()
  private canvas: HTMLCanvasElement
  private labelZone: HTMLDivElement
  private renderer: WebGLRenderer
  private clock: Clock
  private camera: PerspectiveCamera
  private thirdCamera: PerspectiveCamera
  private thirdFrontCamera: PerspectiveCamera
  private activeCamera: PerspectiveCamera
  private lodCamera: PerspectiveCamera
  private player: Object3D
  private scene: Scene
  private light: AmbientLight
  private dirLight: DirectionalLight
  private dirLightTarget: Object3D
  private avatar: Group
  private skybox: Group
  private buildMode = false
  private flyMode = false
  private userState = 'idle'
  private userGesture: string = null
  private hoveredObject: Group

  private playerCollider: PlayerCollider
  private playerColliderBox: Group
  private boxMaterial: MeshBasicMaterial
  private playerVelocity = new Vector3()
  private playerOnFloor = true

  private frameId: number = null
  private deltaFps = 0
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

  private chunkTile = [0, 0]

  private keyActionMap = new Map([
    [PressedKey.moveFwd, ObjectAct.forward],
    [PressedKey.turnRgt, ObjectAct.right],
    [PressedKey.moveRgt, ObjectAct.right],
    [PressedKey.moveBck, ObjectAct.backward],
    [PressedKey.turnLft, ObjectAct.left],
    [PressedKey.moveLft, ObjectAct.left],
    [PressedKey.lookUp, ObjectAct.rotY],
    [PressedKey.lookDwn, ObjectAct.rotnY],
    [PressedKey.moveUp, ObjectAct.up],
    [PressedKey.moveDwn, ObjectAct.down],
    // [PressedKey.divide, ObjectAct.rotX],
    // [PressedKey.multiply, ObjectAct.rotnX],
    // [PressedKey.home, ObjectAct.rotZ],
    // [PressedKey.end, ObjectAct.rotnZ],
    [PressedKey.esc, ObjectAct.deselect],
    [PressedKey.cpy, ObjectAct.copy],
    [PressedKey.del, ObjectAct.delete]
  ])

  public constructor(
    private ngZone: NgZone,
    private userSvc: UserService,
    private inputSysSvc: InputSystemService,
    private objSvc: ObjectService,
    private teleportSvc: TeleportService
  ) {}

  public cancel(): void {
    if (this.frameId != null) {
      cancelAnimationFrame(this.frameId)
    }
    if (this.renderer != null) {
      this.renderer.dispose()
      this.renderer.forceContextLoss()
      this.renderer = null
      this.canvas = null
    }
  }

  public localUserPosObservable() {
    return this.localUserPosSub.asObservable()
  }

  public texturesAnimationObservable() {
    return this.texturesAnimationSub.asObservable()
  }

  public createScene(
    canvas: ElementRef<HTMLCanvasElement>,
    labelZone: ElementRef<HTMLDivElement>,
    labelDesc: ElementRef<HTMLDivElement>
  ): void {
    this.canvas = canvas.nativeElement
    this.labelZone = labelZone.nativeElement
    this.labelDesc = labelDesc.nativeElement
    this.labelDesc.innerHTML = ''

    Cache.enabled = true
    this.renderer = new WebGLRenderer({
      canvas: this.canvas,
      alpha: false, // transparent background
      antialias: true, // smooth edges
      stencil: false
    })
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.shadowMap.enabled = false
    this.renderer.outputColorSpace = SRGBColorSpace

    this.scene = new Scene()

    this.player = new Object3D()
    this.player.rotation.order = 'YXZ'
    this.worldNode.add(this.player)

    this.camera = new PerspectiveCamera(
      50,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    )
    this.camera.rotation.order = 'YXZ'
    this.camera.position.y = 0
    this.lodCamera = this.camera.clone()
    this.scene.add(this.lodCamera)
    this.player.attach(this.camera)

    this.thirdCamera = new PerspectiveCamera(
      50,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    )
    this.thirdCamera.rotation.order = 'YXZ'
    this.thirdCamera.position.z = 6
    this.thirdCamera.position.y = 0.2
    this.camera.attach(this.thirdCamera)

    this.thirdFrontCamera = new PerspectiveCamera(
      50,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    )
    this.thirdFrontCamera.rotation.order = 'YXZ'
    this.thirdFrontCamera.position.z = -6
    this.thirdFrontCamera.position.y = 0.2
    this.thirdFrontCamera.rotation.y = Math.PI
    this.camera.attach(this.thirdFrontCamera)

    this.activeCamera = this.camera

    this.skybox = new Group()
    this.skybox.scale.set(500, 500, 500)
    this.skybox.name = 'skybox'
    this.worldNode.add(this.skybox)

    this.light = new AmbientLight(0xffffff, 0.8)
    this.light.position.z = 100
    this.worldNode.add(this.light)

    // this.scene.fog = new Fog(0xCCCCCC, 10, 50)

    this.dirLightTarget = new Object3D()
    this.worldNode.add(this.dirLightTarget)

    this.dirLight = new DirectionalLight(0xffffff, 0.5)
    this.dirLight.name = 'dirlight'
    this.dirLight.shadow.camera.left = 100
    this.dirLight.shadow.camera.right = -100
    this.dirLight.shadow.camera.top = 100
    this.dirLight.shadow.camera.bottom = -100
    this.dirLight.shadow.mapSize.width = 2048
    this.dirLight.shadow.mapSize.height = 2048
    this.dirLight.target = this.dirLightTarget
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

  public updateBoundingBox() {
    const boxHeight = this.camera.position.y * 1.11
    const {position} = this.player
    this.playerCollider = new PlayerCollider(boxHeight, position)

    if (config.debug) {
      for (const item of this.worldNode.children.filter(
        (i) => i.name === 'boundingBox'
      )) {
        this.disposeMaterial(item as Group)
        this.worldNode.remove(item)
      }
      const boxPos = new Vector3(0, boxHeight / 2, 0).add(position)
      const boundingBox = new Group()
      boundingBox.name = 'boundingBox'
      const mainBoxGeometry = new BoxGeometry(
        playerBoxSide,
        boxHeight,
        playerBoxSide
      )
      const topBoxGeometry = new BoxGeometry(
        playerBoxSide,
        boxHeight - playerClimbHeight,
        playerBoxSide
      )
      const bottomBoxGeometry = new BoxGeometry(
        playerBoxSide,
        playerClimbHeight,
        playerBoxSide
      )
      this.boxMaterial = new MeshBasicMaterial({
        color: 0x00ff00,
        wireframe: true
      })

      const mainBox = new Mesh(mainBoxGeometry, [
        this.boxMaterial,
        this.boxMaterial,
        this.boxMaterial,
        this.boxMaterial,
        this.boxMaterial,
        this.boxMaterial
      ])
      const topBox = new Mesh(topBoxGeometry, [
        this.boxMaterial,
        this.boxMaterial,
        this.boxMaterial,
        this.boxMaterial,
        this.boxMaterial,
        this.boxMaterial
      ])
      const bottomBox = new Mesh(bottomBoxGeometry, [
        this.boxMaterial,
        this.boxMaterial,
        this.boxMaterial,
        this.boxMaterial,
        this.boxMaterial,
        this.boxMaterial
      ])

      topBox.position.set(
        0,
        (boxHeight - (boxHeight - playerClimbHeight)) / 2,
        0
      )
      bottomBox.position.set(0, (playerClimbHeight - boxHeight) / 2, 0)
      boundingBox.add(mainBox)
      boundingBox.add(topBox)
      boundingBox.add(bottomBox)
      boundingBox.position.set(boxPos.x, boxPos.y, boxPos.z)
      boundingBox.userData.mainBox = mainBox
      boundingBox.userData.topBox = topBox
      boundingBox.userData.bottomBox = bottomBox
      this.playerColliderBox = boundingBox
      this.worldNode.add(boundingBox)
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
    const user = this.userSvc.userList.find((u) => u.id === group.name)
    div.innerHTML = user ? user.name : ''
    this.labelZone.appendChild(div)
  }

  public getPosition(): [Vector3, Vector3] {
    if (this.player == null) {
      return [new Vector3(), new Vector3()]
    } else {
      return [
        this.player.position.clone(),
        new Vector3().setFromEuler(this.player.rotation)
      ]
    }
  }

  public getYaw(): number {
    return Math.round(this.compass.theta / DEG)
  }

  public setGesture(gesture: string) {
    this.userGesture = gesture
  }

  public getGesture(): string {
    return this.userGesture
  }

  public getState(): string {
    return this.userState
  }

  public setAmbLightColor(r = 255, g = 255, b = 255) {
    this.light.color = new Color(r / 255, g / 255, b / 255)
  }

  public setDirLightColor(r = 255, g = 255, b = 255) {
    this.dirLight.color = new Color(r / 255, g / 255, b / 255)
  }

  public setDirLightTarget(x = -0.8, y = -0.5, z = -0.2) {
    this.dirLightTarget.position.set(x * 100, y * 100, z * 100)
  }

  public attachCam(group: Group) {
    this.avatar = group
    this.avatar.visible = this.activeCamera === this.thirdCamera
    this.player.attach(this.avatar)
  }

  public setCameraOffset(offset: number) {
    this.camera.position.y = offset
    this.avatar.position.y =
      this.player.position.y + this.avatar.userData.offsetY
  }

  public addChunk(chunk: LOD) {
    chunk.matrixAutoUpdate = false
    this.objectsNode.add(chunk)

    // Update levels of the LOD so the chunk doesn't get visible right from the start
    chunk.update(this.activeCamera)

    for (const child of chunk.levels[0].object.children) {
      this.handleSpecialObject(child as Group)
    }

    this.chunkMap.set(
      chunk.userData.world.chunk.x * chunkIndexStep +
        chunk.userData.world.chunk.z,
      chunk
    )

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

    const chunk = group.parent as Group
    chunk.remove(group)

    // Regenerate boundsTree for this LOD
    PlayerCollider.updateChunkBVH(chunk)
  }

  public removeWorldObject(group: Group) {
    if (group) {
      this.disposeMaterial(group)
      group.traverse((child: Object3D) => {
        if (child instanceof Mesh) {
          child.geometry.dispose()
        }
      })
      if (group.parent) {
        group.parent.remove(group)
      }
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

  public getMemInfo() {
    return this.renderer.info.memory
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
      fromEvent(window, 'visibilitychange').subscribe(() => {
        if (document.visibilityState === 'visible') {
          this.clock.start()
        } else {
          this.clock.stop()
        }
      })
      fromEvent(this.canvas, 'contextmenu').subscribe((e: MouseEvent) =>
        this.rightClick(e)
      )
      fromEvent(this.canvas, 'mousemove').subscribe((e: MouseEvent) => {
        this.mouseIdle = 0
        this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1
        this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1
      })
      fromEvent(this.canvas, 'mousedown').subscribe((e: MouseEvent) => {
        if (e.button === 0) {
          this.leftClick(e)
        }
      })
      this.inputSysSvc.keyDownEvent.subscribe((k) => {
        // reset tooltip
        this.mouseIdle = 0
        this.labelDesc.style.display = 'none'
        this.hoveredObject = null
        if (this.buildMode) {
          const act =
            this.keyActionMap.get(this.inputSysSvc.getKey(k.code)) ||
            ObjectAct.nop
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
        document.body.style.cursor = 'default'
        const item = this.pointedItem()
        if (item != null && item.userData?.clickable === true) {
          document.body.style.cursor = 'pointer'
        }
        if (this.mouseIdle >= 10) {
          if (item !== this.hoveredObject) {
            this.labelDesc.style.display = 'none'
            this.hoveredObject = item
            if (item != null && item.userData?.desc) {
              this.labelDesc.style.display = 'block'
              this.labelDesc.innerHTML = item.userData.desc
              this.labelDesc.style.left =
                ((this.mouse.x + 1) / 2) * window.innerWidth + 'px'
              this.labelDesc.style.top =
                (-(this.mouse.y - 1) / 2) * window.innerHeight + 'px'
            }
          }
          this.mouseIdle = 5
        }
      })
    })
  }

  public toggleCamera() {
    if (this.activeCamera === this.camera) {
      this.activeCamera = this.thirdCamera
    } else if (this.activeCamera === this.thirdCamera) {
      this.activeCamera = this.thirdFrontCamera
    } else if (this.activeCamera === this.thirdFrontCamera) {
      this.activeCamera = this.camera
    }
    this.avatar.visible = this.activeCamera !== this.camera
  }

  public setPlayerPos(pos: Vector3 | string, yaw = 0): void {
    if (this.player == null || pos == null) {
      return
    }
    if (typeof pos === 'string') {
      const yawMatch = pos.match(/\s([0-9]+)$/)
      yaw = yawMatch ? parseInt(yawMatch[1], 10) : 0
      pos = Utils.stringToPos(pos)
    }
    this.player.position.copy(pos)
    this.setPlayerYaw(yaw)
    this.updateBoundingBox()
  }

  public setPlayerYaw(yaw: number) {
    this.player.rotation.y = Utils.radNormalized(yaw * DEG + Math.PI)
  }

  public getLODs(): LOD[] {
    return this.objectsNode.children as LOD[]
  }

  public updateSelectionBox(): void {
    this.selectedObject.updateMatrix()
    const chunkData = this.selectedObject.parent.userData.world.chunk
    const center = new Vector3(
      this.selectedObject.userData.boxCenter.x,
      this.selectedObject.userData.boxCenter.y,
      this.selectedObject.userData.boxCenter.z
    )
    this.selectionBox.position.copy(center)
    center.applyAxisAngle(yAxis, this.selectedObject.rotation.y)
    center.applyAxisAngle(zAxis, this.selectedObject.rotation.z)
    center.applyAxisAngle(xAxis, this.selectedObject.rotation.x)
    this.selectionGroup.position.copy(
      new Vector3(
        chunkData.x + this.selectedObject.position.x,
        this.selectedObject.position.y,
        chunkData.z + this.selectedObject.position.z
      )
    )
    this.selectionGroup.rotation.copy(this.selectedObject.rotation)
    this.selectionGroup.updateMatrix()
  }

  public setChunkTile(chunkX: number, chunkZ: number) {
    this.chunkTile = [chunkX, chunkZ]
  }

  public resetChunkMap() {
    this.chunkMap.clear()
  }

  public getNearestChunks() {
    const lods = []
    nearestChunkPattern.forEach((offset) => {
      const lod = this.chunkMap.get(
        (this.chunkTile[0] + offset.x) * chunkIndexStep +
          this.chunkTile[1] +
          offset.z
      )
      if (lod !== undefined) {
        lods.push(lod)
      }
    })

    return lods
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
    this.lodCamera.position.set(
      this.player.position.x,
      0,
      this.player.position.z
    )
    this.lodCamera.rotation.copy(this.player.rotation)
    this.lodCamera.updateMatrix()
    this.lodCamera.updateProjectionMatrix()

    for (const lod of this.objectsNode.children as LOD[]) {
      lod.update(this.lodCamera)
    }
  }

  private render(): void {
    this.frameId = requestAnimationFrame(() => this.render())

    this.deltaFps += this.clock.getDelta()

    if (this.deltaFps <= 1 / this.maxFps()) {
      return
    }
    this.fpsSub.next((1 / this.deltaFps).toFixed())
    this.deltaSinceLastFrame = this.deltaFps
    this.deltaFps = (this.deltaFps % 1) / this.maxFps()
    this.renderer.render(this.scene, this.activeCamera)

    if (this.animationElapsed > 0.1) {
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
  }

  private resize(): void {
    if (this.renderer == null) {
      return
    }
    const width = window.innerWidth
    const height = window.innerHeight
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.thirdCamera.aspect = width / height
    this.thirdCamera.updateProjectionMatrix()
    this.thirdFrontCamera.aspect = width / height
    this.thirdFrontCamera.updateProjectionMatrix()
    this.renderer.setSize(width, height)
  }

  private deselect() {
    PlayerCollider.updateObjectBVH(this.selectedObject)
    this.buildMode = false
    this.selectedObject = null
    this.selectedObjectSignal.set({})
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
    this.selectedObjectSignal.set({
      name: item.name,
      desc: item.userData.desc,
      act: item.userData.act,
      date: item.userData.date
    })
    console.log(item)

    const geometry = new BoxGeometry(
      item.userData.box.x,
      item.userData.box.y,
      item.userData.box.z
    )
    const edges = new EdgesGeometry(geometry)
    this.selectionGroup = new Group()
    this.selectionBox = new LineSegments(
      edges,
      new LineBasicMaterial({color: 0xffff00, depthTest: false})
    )
    this.axesHelper = new AxesHelper(5)
    ;(this.axesHelper.material as Material).depthTest = false
    this.selectionGroup.add(this.selectionBox, this.axesHelper)

    this.updateSelectionBox()

    this.scene.add(this.selectionGroup)
  }

  private pointedItem() {
    this.raycaster.setFromCamera(this.mouse, this.activeCamera)
    const intersects = this.raycaster.intersectObjects(
      this.objectsNode.children,
      true
    )
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

  private leftClick(_: MouseEvent) {
    if (this.selectionBox != null) {
      this.deselect()
    } else {
      const item = this.pointedItem()
      if (
        item != null &&
        item.userData?.clickable &&
        item.userData.teleportClick != null
      ) {
        let [newX, newY, newZ] = [null, null, null]
        const yaw = item.userData.teleportClick?.direction || 0
        if (item.userData.teleportClick.altitude != null) {
          if (
            item.userData.teleportClick.altitude.altitudeType === 'absolute'
          ) {
            newY = item.userData.teleportClick.altitude.value * 10
          } else {
            newY =
              this.player.position.y +
              item.userData.teleportClick.altitude.value * 10
          }
        }
        if (item.userData.teleportClick.coordinates != null) {
          if (
            item.userData.teleportClick.coordinates.coordinateType ===
            'absolute'
          ) {
            newX = item.userData.teleportClick.coordinates.EW * -10
            newZ = item.userData.teleportClick.coordinates.NS * 10
          } else {
            newX =
              this.player.position.x +
              item.userData.teleportClick.coordinates.x * -10
            newZ =
              this.player.position.z +
              item.userData.teleportClick.coordinates.y * 10
          }
        }
        this.teleportSvc.teleport.set({
          world: item.userData.teleportClick.worldName,
          // Don't send 0 if coordinates are null (world entry point)
          position:
            newX == null || newY == null || newZ == null
              ? null
              : Utils.posToString(new Vector3(newX, newY, newZ), yaw),
          isNew: true
        })
      }
    }
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
    const allowRotation =
      this.selectedObject.userData.rwx?.axisAlignment === 'none'
    let moveStep = 0.5
    let rotStep = Math.PI / 12
    if (this.inputSysSvc.controls[PressedKey.clip]) {
      moveStep = 0.05
      rotStep = Math.PI / 120
      if (this.inputSysSvc.controls[PressedKey.run]) {
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
      case ObjectAct.up: {
        this.selectedObject.translateY(moveStep)
        this.updateSelectionBox()
        break
      }
      case ObjectAct.down: {
        this.selectedObject.translateY(-moveStep)
        this.updateSelectionBox()
        break
      }
      case ObjectAct.forward: {
        this.selectedObject.position.add(v.multiplyScalar(moveStep))
        this.updateSelectionBox()
        break
      }
      case ObjectAct.backward: {
        this.selectedObject.position.add(v.multiplyScalar(-moveStep))
        this.updateSelectionBox()
        break
      }
      case ObjectAct.left: {
        this.selectedObject.position.add(
          new Vector3(v.z * moveStep, 0, v.x * -moveStep)
        )
        this.updateSelectionBox()
        break
      }
      case ObjectAct.right: {
        this.selectedObject.position.add(
          new Vector3(v.z * -moveStep, 0, v.x * moveStep)
        )
        this.updateSelectionBox()
        break
      }
      case ObjectAct.rotY: {
        if (allowRotation) {
          this.selectedObject.rotateOnAxis(yAxis, rotStep)
          this.updateSelectionBox()
        }
        break
      }
      case ObjectAct.rotnY: {
        if (allowRotation) {
          this.selectedObject.rotateOnAxis(yAxis, -rotStep)
          this.updateSelectionBox()
        }
        break
      }
      case ObjectAct.rotX: {
        if (allowRotation) {
          this.selectedObject.rotateOnAxis(xAxis, rotStep)
          this.updateSelectionBox()
        }
        break
      }
      case ObjectAct.rotnX: {
        if (allowRotation) {
          this.selectedObject.rotateOnAxis(xAxis, -rotStep)
          this.updateSelectionBox()
        }
        break
      }
      case ObjectAct.rotZ: {
        if (allowRotation) {
          this.selectedObject.rotateOnAxis(zAxis, rotStep)
          this.updateSelectionBox()
        }
        break
      }
      case ObjectAct.rotnZ: {
        if (allowRotation) {
          this.selectedObject.rotateOnAxis(zAxis, -rotStep)
          this.updateSelectionBox()
        }
        break
      }
      case ObjectAct.snapGrid: {
        this.selectedObject.position.set(
          Math.round(this.selectedObject.position.x * 2) / 2,
          Math.round(this.selectedObject.position.y * 2) / 2,
          Math.round(this.selectedObject.position.z * 2) / 2
        )
        this.updateSelectionBox()
        break
      }
      case ObjectAct.rotReset: {
        if (allowRotation) {
          this.selectedObject.rotation.set(0, 0, 0)
          this.updateSelectionBox()
        }
        break
      }
      case ObjectAct.copy: {
        const {parent} = this.selectedObject
        this.selectedObject = this.selectedObject.clone()
        this.selectedObject.position.add(v.multiplyScalar(moveStep))
        parent.add(this.selectedObject)
        this.updateSelectionBox()
        break
      }
      case ObjectAct.delete: {
        this.removeObject(this.selectedObject)
        return
      }
      default:
        return
    }
  }

  private stepPlayerPosition(
    oldPosition: Vector3,
    delta: Vector3,
    originalDelta: Vector3
  ): boolean {
    let keepGoing = true
    const newPosition = oldPosition.clone().add(delta)
    const terrain = this.worldNode.children.find(
      (o) => o.name === 'terrain'
    ) as any

    this.playerCollider.copyPos(newPosition)

    this.boxMaterial?.color.setHex(0x00ff00)

    let climbHeight = null
    let minHeight = null
    let boxCollision = false
    let feetCollision = false

    this.playerOnFloor = false

    const intersectsTriangle = (tri: Triangle) => {
      // Check if the triangle is intersecting the boundingBox and later adjust the
      // boundingBox position if it is.

      const collision = this.playerCollider.topBoxIntersectsTriangle(tri)
      const rayIntersectionPoint =
        this.playerCollider.raysIntersectTriangle(tri)

      if (this.playerCollider.bottomBoxIntersectsTriangle(tri)) {
        feetCollision = true
      }

      if (collision) {
        boxCollision = true
        this.boxMaterial?.color.setHex(0xff0000)
      }

      if (
        rayIntersectionPoint != null &&
        rayIntersectionPoint.y > newPosition.y
      ) {
        this.boxMaterial?.color.setHex(0xffff00)

        if (climbHeight == null || climbHeight < rayIntersectionPoint.y) {
          climbHeight = rayIntersectionPoint.y
        }

        if (minHeight == null || minHeight < rayIntersectionPoint.y) {
          minHeight = rayIntersectionPoint.y
        }
      }
    }

    terrain?.userData.boundsTree?.shapecast({
      intersectsBounds: (box: Box3) =>
        box.intersectsBox(this.playerCollider.mainBox),
      intersectsTriangle
    })

    // We expect maximum 9 LODs to be available to test collision: the one the player
    // stands in and the 8 neighbouring ones (sides and corners)
    for (const lod of this.getNearestChunks()) {
      const lodOffset = lod.position
      this.playerCollider.translate(lodOffset.negate())

      lod.userData.boundsTree?.shapecast({
        intersectsBounds: (box: Box3) =>
          box.intersectsBox(this.playerCollider.mainBox),
        intersectsTriangle
      })

      this.playerCollider.translate(lodOffset.negate())
    }

    if (boxCollision) {
      this.playerVelocity.set(0.0, 0.0, 0.0)
      this.playerCollider.copyPos(oldPosition)
      this.player.position.copy(oldPosition)
      keepGoing = false
    } else {
      if (this.playerVelocity.y <= 0 && climbHeight !== null) {
        // Player is on floor
        this.playerVelocity.setY(0.0)
        newPosition.setY(climbHeight - playerGroundAdjust)
        this.playerOnFloor = true
        this.flyMode = false
      }

      if (
        this.playerVelocity.y > 0 &&
        minHeight !== null &&
        climbHeight !== minHeight
      ) {
        // Player hits the ceiling
        this.playerVelocity.setY(0.0)
        newPosition.setY(minHeight - playerGroundAdjust)
      }

      if (
        climbHeight === null &&
        feetCollision &&
        newPosition.y + playerGroundAdjust < oldPosition.y
      ) {
        // Prevent the player from falling in a small gap
        this.playerVelocity.setY(0.0)
        newPosition.setY(oldPosition.y)
      }

      if (feetCollision) {
        this.flyMode = false
        if (originalDelta.y < 0.0) {
          originalDelta.setY(0.0)
        }
      }

      this.playerCollider.copyPos(newPosition)
      this.player.position.copy(newPosition)
    }

    return keepGoing
  }

  private updatePlayerPosition() {
    this.playerVelocity.y =
      this.playerOnFloor && !this.flyMode
        ? 0
        : this.deltaSinceLastFrame * 0.01 + this.playerVelocity.y

    this.player.updateMatrixWorld()

    const boxHeight: number = this.playerCollider?.boxHeight

    const deltaPosition = this.playerVelocity
      .clone()
      .multiplyScalar(this.deltaSinceLastFrame)
    const oldPosition = this.player.position.clone()
    const newPosition = oldPosition.clone().add(deltaPosition)

    this.avatar.userData.animationPlayer?.then(
      (animation: AvatarAnimationPlayer) => {
        const velocity = this.playerVelocity.length()

        this.userState = 'idle'

        if (Math.abs(velocity) > 0.1) {
          this.userState = 'walk'
        }

        if (Math.abs(velocity) > 5.5) {
          this.userState = 'run'
        }

        if (this.flyMode) {
          this.userState = 'fly'
        }

        // When applicable: reset gesture on completion
        this.userGesture = animation.animate(
          this.deltaSinceLastFrame,
          this.userState,
          this.userGesture,
          this.inputSysSvc.controls[PressedKey.moveBck] ? -velocity : velocity
        )
          ? null
          : this.userGesture
      }
    )

    if (!this.inputSysSvc.controls[PressedKey.clip] && this.playerCollider) {
      let deltaLength = deltaPosition.length()

      for (let i = 0; deltaLength > 0.0 && i < playerMaxNbSteps; i++) {
        // Do not proceed in steps longer than the dimensions on the colliding box
        // Interpolate the movement by moving step by step, stop if we collide with something, continue otherwise
        const deltaScalar = Math.min(playerMaxStepLength, deltaLength)
        const nextDelta = deltaPosition
          .clone()
          .normalize()
          .multiplyScalar(deltaScalar)
        deltaLength -= playerMaxStepLength
        if (
          !this.stepPlayerPosition(
            this.player.position.clone(),
            nextDelta,
            deltaPosition
          )
        ) {
          break
        }
      }
    } else {
      this.player.position.copy(newPosition)
    }

    this.playerCollider?.copyPos(this.player.position)
    this.playerColliderBox?.position.set(
      this.player.position.x,
      this.player.position.y + boxHeight / 2.0,
      this.player.position.z
    )

    if (this.player.position.y < -350) {
      this.playerVelocity.set(0.0, 0.0, 0.0)
      this.player.position.y = 0
    }

    this.localUserPosSub.next(this.player.position)
  }

  private moveCamera() {
    this.activeCamera.getWorldDirection(this.cameraDirection)
    let movSteps = 12 * this.deltaSinceLastFrame
    let rotSteps = 1.5 * this.deltaSinceLastFrame
    const reverse = this.activeCamera === this.thirdFrontCamera ? -1 : 1
    if (this.inputSysSvc.controls[PressedKey.run]) {
      movSteps = this.flyMode
        ? 72 * this.deltaSinceLastFrame
        : 24 * this.deltaSinceLastFrame
      rotSteps *= 3
    }
    if (this.inputSysSvc.controls[PressedKey.moveFwd]) {
      this.playerVelocity.add(
        new Vector3(
          reverse * this.cameraDirection.x,
          0,
          reverse * this.cameraDirection.z
        ).multiplyScalar(movSteps)
      )
    }
    if (this.inputSysSvc.controls[PressedKey.moveBck]) {
      this.playerVelocity.add(
        new Vector3(
          reverse * -this.cameraDirection.x,
          0,
          reverse * -this.cameraDirection.z
        ).multiplyScalar(movSteps)
      )
    }
    if (this.inputSysSvc.controls[PressedKey.turnLft]) {
      if (this.inputSysSvc.controls[PressedKey.clip]) {
        this.playerVelocity.add(
          new Vector3(
            reverse * this.cameraDirection.z,
            0,
            reverse * -this.cameraDirection.x
          ).multiplyScalar(movSteps)
        )
      } else {
        this.player.rotation.y = Utils.radNormalized(
          this.player.rotation.y + reverse * rotSteps
        )
      }
    }
    if (this.inputSysSvc.controls[PressedKey.turnRgt]) {
      if (this.inputSysSvc.controls[PressedKey.clip]) {
        this.playerVelocity.add(
          new Vector3(
            reverse * -this.cameraDirection.z,
            0,
            reverse * this.cameraDirection.x
          ).multiplyScalar(movSteps)
        )
      } else {
        this.player.rotation.y = Utils.radNormalized(
          this.player.rotation.y - reverse * rotSteps
        )
      }
    }
    if (this.inputSysSvc.controls[PressedKey.moveLft]) {
      this.playerVelocity.add(
        new Vector3(
          reverse * this.cameraDirection.z,
          0,
          reverse * -this.cameraDirection.x
        ).multiplyScalar(movSteps)
      )
    }
    if (this.inputSysSvc.controls[PressedKey.moveRgt]) {
      this.playerVelocity.add(
        new Vector3(
          reverse * -this.cameraDirection.z,
          0,
          reverse * this.cameraDirection.x
        ).multiplyScalar(movSteps)
      )
    }
    if (
      this.inputSysSvc.controls[PressedKey.lookUp] &&
      this.player.rotation.x < Math.PI / 2
    ) {
      this.player.rotation.x += rotSteps
    }
    if (
      this.inputSysSvc.controls[PressedKey.lookDwn] &&
      this.player.rotation.x > -Math.PI / 2
    ) {
      this.player.rotation.x -= rotSteps
    }
    if (this.inputSysSvc.controls[PressedKey.moveUp]) {
      this.flyMode = true
      this.playerVelocity.add(new Vector3(0, 1, 0).multiplyScalar(movSteps))
    }
    if (this.inputSysSvc.controls[PressedKey.moveDwn]) {
      this.flyMode = true
      this.playerVelocity.add(new Vector3(0, 1, 0).multiplyScalar(-movSteps))
    }
    if (this.inputSysSvc.controls[PressedKey.jmp] && this.playerOnFloor) {
      this.player.position.setY(this.player.position.y + playerClimbHeight)
    }
    const damping = Math.exp(-3 * this.deltaSinceLastFrame) - 1
    if (this.playerOnFloor) {
      this.playerVelocity.addScaledVector(this.playerVelocity, damping)
    } else if (!this.flyMode && !this.inputSysSvc.controls[PressedKey.clip]) {
      this.playerVelocity.y -= 30 * this.deltaSinceLastFrame
    } else {
      this.playerVelocity.addScaledVector(this.playerVelocity, damping)
    }

    this.updatePlayerPosition()

    for (const item of this.sprites) {
      item.rotation.y = this.player.rotation.y
      item.updateMatrix()
    }

    this.skybox.position.copy(this.player.position)
    this.dirLight.position.set(
      -50 + this.player.position.x,
      80 + this.player.position.y,
      10 + this.player.position.z
    )

    // compass
    this.compass.setFromVector3(this.cameraDirection)
    this.compassSub.next({
      pos: {
        x: Math.round(this.player.position.x * 100) / 100,
        y: Math.round(this.player.position.y * 100) / 100,
        z: Math.round(this.player.position.z * 100) / 100
      },
      theta: this.getYaw()
    })
  }

  private animateItems() {
    for (const item of this.animatedObjects) {
      if (item.userData.move) {
        if (item.userData.move.waiting > 0) {
          item.userData.move.waiting -= this.deltaSinceLastFrame
        } else if (item.userData.move.completion < 1) {
          // move is in progress
          item.position.x +=
            (item.userData.move.distance.x / item.userData.move.time) *
            this.deltaSinceLastFrame *
            item.userData.move.direction
          item.position.y +=
            (item.userData.move.distance.y / item.userData.move.time) *
            this.deltaSinceLastFrame *
            item.userData.move.direction
          item.position.z +=
            (item.userData.move.distance.z / item.userData.move.time) *
            this.deltaSinceLastFrame *
            item.userData.move.direction
          item.userData.move.completion +=
            this.deltaSinceLastFrame / item.userData.move.time
        } else if (item.userData.move.direction === -1) {
          // wayback is done
          if (item.userData.move.loop) {
            item.userData.move.direction *= -1
            item.userData.move.completion = 0
          }
        } else if (item.userData.move.reset) {
          // no wayback, all done
          item.position.copy(item.userData.move.orig)
          if (item.userData.move.loop) {
            // loop
            item.userData.move.completion = 0
          }
        } else {
          item.userData.move.waiting = item.userData.move.wait
          // wayback is starting
          item.userData.move.direction *= -1
          item.userData.move.completion = 0
        }
      }
      if (item.userData.rotate) {
        if (item.userData.rotate.waiting > 0) {
          item.userData.rotate.waiting -= this.deltaSinceLastFrame
        } else {
          item.rotateOnAxis(
            yAxis,
            item.userData.rotate.speed.y *
              RPM *
              this.deltaSinceLastFrame *
              item.userData.rotate.direction
          )
          item.rotateOnAxis(
            zAxis,
            item.userData.rotate.speed.z *
              RPM *
              this.deltaSinceLastFrame *
              item.userData.rotate.direction
          )
          item.rotateOnAxis(
            xAxis,
            item.userData.rotate.speed.x *
              RPM *
              this.deltaSinceLastFrame *
              item.userData.rotate.direction
          )
          if (
            item.userData.rotate.time &&
            item.userData.rotate.completion >= 1
          ) {
            if (item.userData.rotate.loop) {
              item.userData.rotate.completion = 0
              if (item.userData.rotate.reset) {
                item.rotation.copy(item.userData.rotate.orig)
              } else {
                item.userData.rotate.waiting = item.userData.rotate.wait
                item.userData.rotate.direction *= -1
              }
            }
            item.userData.rotate.completion +=
              this.deltaSinceLastFrame / item.userData.rotate.time
          }
        }
      }
      item.updateMatrix()
    }
  }

  private moveUsers() {
    this.userSvc.userList
      .filter((u) => this.usersNode.children.find((o) => o.name === u.id))
      .forEach((u) => {
        const user = this.usersNode.children.find((o) => o.name === u.id)
        u.completion = Math.min(
          1,
          u.completion + this.deltaSinceLastFrame / 0.2
        )
        const previousPos = user.position.clone()
        user.position.x = u.oldX + (u.x - u.oldX) * u.completion
        user.position.y = u.oldY + (u.y - u.oldY) * u.completion
        if (user.userData.offsetY != null) {
          // when the avatar is not loaded yet, the position should not be corrected
          user.position.y += user.userData.offsetY
        }
        user.position.z = u.oldZ + (u.z - u.oldZ) * u.completion
        user.rotation.set(
          u.oldRoll + Utils.shortestAngle(u.oldRoll, u.roll) * u.completion,
          u.oldYaw + Utils.shortestAngle(u.oldYaw, u.yaw) * u.completion,
          0,
          'YZX'
        )
        user.userData.animationPlayer?.then(
          (animation: AvatarAnimationPlayer) => {
            const velocity =
              previousPos.distanceTo(user.position) / this.deltaSinceLastFrame
            if (u.completion < 1) {
              // When applicable: reset gesture on completion
              u.gesture = animation.animate(
                this.deltaSinceLastFrame,
                u.state,
                u.gesture,
                velocity
              )
                ? null
                : u.gesture
            } else {
              // Same here: reset gesture on completion
              u.gesture = animation.animate(
                this.deltaSinceLastFrame,
                u.state,
                u.gesture
              )
                ? null
                : u.gesture
            }
          }
        )
      })
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
      vector.x = ((vector.x + 1) / 2) * window.innerWidth
      vector.y = (-(vector.y - 1) / 2) * window.innerHeight
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
}
