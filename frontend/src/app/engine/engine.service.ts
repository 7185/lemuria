import {BehaviorSubject, fromEvent, Subject, timer} from 'rxjs'
import {effect, Injectable, NgZone, signal} from '@angular/core'
import type {ElementRef} from '@angular/core'
import {
  Cache,
  Clock,
  Fog,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Group,
  BoxGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
  Object3D,
  Spherical,
  Mesh,
  MeshBasicMaterial,
  SRGBColorSpace,
  Color,
  PointLight
} from 'three'
import {
  CSS2DObject,
  CSS2DRenderer
} from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import type {DirectionalLight, LOD, Sprite, Triangle} from 'three'
import {BuildService} from './build.service'
import {TeleportService} from './teleport.service'
import {UserService} from '../user'
import {ObjectAct, ObjectService} from '../world/object.service'
import {PropAnimationService} from '../animation'
import type {AvatarAnimationPlayer} from '../animation'
import {PressedKey, InputSystemService} from './inputsystem.service'
import {config} from '../app.config'
import {PlayerCollider} from './player-collider'
import {DEG, TERRAIN_PAGE_SIZE, Utils} from '../utils'

const playerBoxSide = config.world.collider.boxSide
const playerClimbHeight = config.world.collider.climbHeight
const playerGroundAdjust = config.world.collider.groundAdjust
const playerMaxStepLength = config.world.collider.maxStepLength
const playerMaxNbSteps = config.world.collider.maxNbSteps

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
  public compassSub: Subject<{pos: Vector3; theta: number}> = new Subject()
  public fpsSub = new BehaviorSubject<string>('0')
  public maxFps = signal(60)
  public maxLights = signal(6)
  public texturesAnimation = signal(0)
  public playerPosition = signal(new Vector3())
  public worldFog = {color: 0x00007f, near: 0, far: 120, enabled: false}

  private terrain: Group
  private water: Group
  private chunkLODMap = new Map<string, LOD>()
  private compass = new Spherical()
  private canvas: HTMLCanvasElement
  private labelZone: HTMLDivElement
  private renderer: WebGLRenderer
  private labelRenderer: CSS2DRenderer
  private labelMap: Map<string, CSS2DObject> = new Map()
  private clock: Clock
  private camera: PerspectiveCamera
  private thirdCamera: PerspectiveCamera
  private thirdFrontCamera: PerspectiveCamera
  private activeCamera: PerspectiveCamera
  private lodCamera: PerspectiveCamera
  private player: Object3D
  private scene: Scene
  private buildScene: Scene
  private dirLight: DirectionalLight
  private fog = new Fog(0)
  private avatar: Group
  private skybox: Group
  private flyMode = false
  private inWater = signal(false)
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

  private mouse = new Vector2()
  private raycaster = new Raycaster()
  private cameraDirection = new Vector3()
  private cameraPosition = new Vector3()

  private usersNode = new Group()
  private worldNode = new Group()
  private objectsNode = new Group()
  private buildNode = new Group()
  private sprites: Set<Group> = new Set()
  private animatedObjects: Set<Group> = new Set()
  private litObjects: Set<Group> = new Set()
  private pointLights: PointLight[] = []

  private mouseIdle = 0
  private labelDesc: HTMLDivElement

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
    private buildSvc: BuildService,
    private propAnimSvc: PropAnimationService,
    private teleportSvc: TeleportService
  ) {
    this.raycaster.firstHitOnly = true
    effect(() => {
      this.refreshLights(this.maxLights())
    })
    effect(() => {
      this.updateFog(this.inWater())
    })
  }

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
    this.renderer.setPixelRatio(window.devicePixelRatio)
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.shadowMap.enabled = false
    this.renderer.outputColorSpace = SRGBColorSpace
    this.renderer.autoClear = false
    if (!config.debug) {
      this.renderer.debug.checkShaderErrors = false
    }
    this.labelRenderer = new CSS2DRenderer({element: this.labelZone})
    this.labelRenderer.setSize(window.innerWidth, window.innerHeight)

    this.scene = new Scene()
    this.buildScene = new Scene()

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

    this.refreshLights(this.maxLights())

    this.scene.fog = this.fog

    this.scene.add(this.worldNode, this.usersNode, this.objectsNode)
    this.buildScene.add(this.buildNode)
  }

  public clearObjects() {
    this.buildSvc.deselectProp(this.buildNode)
    // Children is a dynamic iterable, we need a copy to get all of them
    for (const item of [...this.objectsNode.children]) {
      this.removeObject(item as Group)
    }
    this.sprites.clear()
    this.animatedObjects.clear()
    // Turn off the lights
    this.litObjects.clear()
    this.updatePointLights()
  }

  public clearScene() {
    this.buildSvc.deselectProp(this.buildNode)
    for (const item of [...this.worldNode.children]) {
      this.removeWorldObject(item as Group)
    }
    this.scene.traverse((child: Object3D) => {
      this.disposeGeometry(child as Group)
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

    if (!config.debug) {
      return
    }

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

    const materials = Array(6).fill(this.boxMaterial)
    const mainBox = new Mesh(mainBoxGeometry, materials)
    const topBox = new Mesh(topBoxGeometry, materials)
    const bottomBox = new Mesh(bottomBoxGeometry, materials)

    topBox.position.set(0, (boxHeight - (boxHeight - playerClimbHeight)) / 2, 0)
    bottomBox.position.set(0, (playerClimbHeight - boxHeight) / 2, 0)
    boundingBox.add(mainBox, topBox, bottomBox)
    boundingBox.position.set(boxPos.x, boxPos.y, boxPos.z)
    boundingBox.userData.mainBox = mainBox
    boundingBox.userData.topBox = topBox
    boundingBox.userData.bottomBox = bottomBox
    this.playerColliderBox = boundingBox
    this.worldNode.add(boundingBox)
  }

  public get position(): [Vector3, Vector3] {
    return this.player == null
      ? [new Vector3(), new Vector3()]
      : [
          this.player.position.clone(),
          new Vector3().setFromEuler(this.player.rotation)
        ]
  }

  public get yaw(): number {
    return Math.round(this.compass.theta / DEG)
  }

  public set gesture(gesture: string) {
    this.userGesture = gesture
  }

  public get gesture(): string {
    return this.userGesture
  }

  public get state(): string {
    return this.userState
  }

  public updateFog(inWater = this.inWater()) {
    if (inWater) {
      this.fog.color = new Color(this.water?.userData?.color ?? 0x00ffff)
      this.fog.near = 0
      this.fog.far = this.water?.userData?.under_view ?? 120
    } else if (this.worldFog.enabled) {
      this.fog.color = new Color(this.worldFog.color)
      this.fog.near = this.worldFog.near
      this.fog.far = this.worldFog.far
    } else {
      this.fog.near = 0
      this.fog.far = 10000
    }
  }

  public attachCam(group: Group) {
    this.avatar = group
    this.avatar.visible = this.activeCamera !== this.camera
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

    this.chunkLODMap.set(
      `${chunk.userData.world.chunk.x}_${chunk.userData.world.chunk.z}`,
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

  public addWorldObject(obj: Object3D) {
    this.worldNode.add(obj)
    switch (obj.name) {
      case 'dirLight':
        this.dirLight = obj as DirectionalLight
        break
      case 'terrain':
        this.terrain = obj as Group
        break
      case 'water':
        this.water = obj as Group
        this.updateFog()
        break
    }
  }

  public addUser(group: Group) {
    const div = document.createElement('div')
    div.className = 'text-label'
    const user = this.userSvc.getUser(group.name)
    div.textContent = user ? user.name : ''

    const label = new CSS2DObject(div)
    this.labelMap.set(group.name, label)
    this.scene.add(label)
    this.usersNode.add(group)
  }

  public setSkybox(skybox: Group) {
    if (!this.skybox) {
      return
    }
    this.disposeMaterial(this.skybox)
    this.disposeGeometry(this.skybox)
    this.skybox.clear()
    this.skybox.add(skybox)
  }

  public disposeGeometry(group: Group) {
    group.traverse((child: Object3D) => {
      if (child instanceof Mesh) {
        child.geometry.dispose()
      }
    })
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
    if (group === this.buildSvc.selectedProp) {
      this.buildSvc.deselectProp(this.buildNode)
    }
    if (group.userData.rwx?.axisAlignment !== 'none') {
      this.sprites.delete(group)
    }
    if (group.userData.rotate != null || group.userData.move != null) {
      this.animatedObjects.delete(group)
    }
    if (group.userData.light != null) {
      this.litObjects.delete(group)
    }
    this.disposeMaterial(group)
    this.disposeGeometry(group)

    const chunk = group.parent as Group
    chunk.remove(group)

    // Regenerate boundsTree for this LOD
    PlayerCollider.updateChunkBVH(chunk)
  }

  public removeLight(light: PointLight) {
    light.dispose()
    if (light.parent) {
      light.parent.remove(light)
    }
  }

  public refreshLights(length: number) {
    if (this.scene == null) {
      return
    }
    this.pointLights.forEach((light: PointLight) => {
      this.removeLight(light)
      light.dispose()
    })
    this.pointLights = Array.from({length}, () => new PointLight(0, 0))
    for (const l of this.pointLights) {
      this.scene.add(l)
    }
  }

  public removeWorldObject(group: Group) {
    if (!group) {
      return
    }

    switch (group.name) {
      case 'dirLight':
        this.dirLight = null
        break
      case 'terrain':
        this.terrain = null
        break
      case 'water':
        this.water = null
        break
    }

    this.disposeMaterial(group)
    this.disposeGeometry(group)

    if (group.parent) {
      group.parent.remove(group)
    }
  }

  public removeUser(group: Group) {
    const label = this.labelMap.get(group.name)
    if (label != null) {
      this.scene.remove(label)
    }
    this.disposeMaterial(group)
    this.disposeGeometry(group)
    this.usersNode.remove(group)
  }

  public users(): Group[] {
    return this.usersNode.children as Group[]
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
        if (this.buildSvc.buildMode) {
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
        if (!this.buildSvc.buildMode) {
          return
        }
        if (act === ObjectAct.delete) {
          // Remove prop from scene and do nothing else
          this.removeObject(this.buildSvc.selectedProp)
          return
        }
        // Handle prop moving and duplication
        this.buildSvc.moveProp(act, this.cameraDirection, this.buildNode)
      })
      timer(0, 100).subscribe(() => {
        this.mouseIdle++
        document.body.style.cursor = 'default'
        const item = this.pointedItem().obj
        if (item != null && item.userData?.clickable === true) {
          document.body.style.cursor = 'pointer'
        }
        if (this.mouseIdle >= 10) {
          if (item !== this.hoveredObject) {
            this.labelDesc.style.display = 'none'
            this.hoveredObject = item
            if (item?.userData?.desc) {
              this.labelDesc.style.display = 'block'
              this.labelDesc.innerHTML = item.userData.desc.replace(
                /[\u0000-\u002F\u003A-\u0040\u005B-\u0060\u007B-\u00FF]/g,
                (c: string) => '&#' + `000${c.charCodeAt(0)}`.slice(-4) + ';'
              )
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
      const yawMatch = /\s(\d+)$/.exec(pos)
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

  public setChunkTile(chunkX: number, chunkZ: number) {
    this.chunkTile = [chunkX, chunkZ]
  }

  public resetChunkLODMap() {
    this.chunkLODMap.clear()
  }

  public getNearestChunks() {
    return nearestChunkPattern
      .map((offset) =>
        this.chunkLODMap.get(
          `${this.chunkTile[0] + offset.x}_${this.chunkTile[1] + offset.z}`
        )
      )
      .filter((lod) => lod !== undefined)
  }

  private handleSpecialObject(group: Group) {
    if (group.userData.rwx?.axisAlignment !== 'none') {
      this.sprites.add(group)
    }
    if (group.userData.rotate != null || group.userData.move != null) {
      this.animatedObjects.add(group)
    }
    if (group.userData.light != null) {
      this.litObjects.add(group)
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
    this.renderer.clear()
    this.renderer.render(this.scene, this.activeCamera)
    this.labelRenderer.render(this.scene, this.activeCamera)
    // Render build scene last
    this.renderer.clearDepth()
    this.renderer.render(this.buildScene, this.activeCamera)

    if (this.animationElapsed > 0.1) {
      this.texturesAnimation.set(this.frameId)
      this.animationElapsed = 0
    } else {
      this.animationElapsed += this.deltaSinceLastFrame
    }

    if (!this.buildSvc.buildMode) {
      this.moveCamera()
      this.animateItems()
      this.updatePointLights()
    }

    this.moveUsers()
  }

  private resize(): void {
    const width = window.innerWidth
    const height = window.innerHeight

    this.camera.aspect =
      this.thirdCamera.aspect =
      this.thirdFrontCamera.aspect =
        width / height
    this.camera.updateProjectionMatrix()
    this.thirdCamera.updateProjectionMatrix()
    this.thirdFrontCamera.updateProjectionMatrix()
    this.lodCamera.updateProjectionMatrix()
    this.renderer?.setSize(width, height)
    this.labelRenderer?.setSize(width, height)
  }

  private pointedItem() {
    this.raycaster.setFromCamera(this.mouse, this.activeCamera)
    const intersects = this.raycaster.intersectObjects(
      this.objectsNode.children.concat(this.terrain ?? []),
      true
    )
    for (const i of intersects) {
      let obj = i.object
      while (obj.parent !== this.terrain && !obj.parent.userData.world?.chunk) {
        obj = obj.parent
      }
      if (obj.name.endsWith('.rwx') && obj.parent.visible) {
        return {obj: obj as Group, faceIndex: i.faceIndex}
      }
      if (obj.parent === this.terrain) {
        // Terrain page
        return {obj: obj as Group, faceIndex: i.faceIndex}
      }
    }
    return {obj: null, faceIndex: 0}
  }

  private leftClick(_: MouseEvent) {
    this.buildSvc.deselectCell(this.buildNode)
    if (this.buildSvc.selectedProp != null) {
      this.buildSvc.deselectProp(this.buildNode)
      // Left click to exit buildMode, do nothing else
      return
    }
    const item = this.pointedItem().obj
    if (item?.userData?.clickable && item?.userData?.teleportClick != null) {
      let [newX, newY, newZ] = [null, null, null]
      const yaw = item.userData.teleportClick?.direction || 0
      if (item.userData.teleportClick.altitude != null) {
        if (item.userData.teleportClick.altitude.altitudeType === 'absolute') {
          newY = item.userData.teleportClick.altitude.value * 10
        } else {
          newY =
            this.player.position.y +
            item.userData.teleportClick.altitude.value * 10
        }
      }
      if (item.userData.teleportClick.coordinates != null) {
        if (
          item.userData.teleportClick.coordinates.coordinateType === 'absolute'
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

  private rightClick(event: MouseEvent) {
    event.preventDefault()
    const {obj, faceIndex} = this.pointedItem()
    if (obj == null) {
      return
    }
    if (obj.parent != null && obj.parent.name === 'terrain') {
      this.buildSvc.selectCell(obj, faceIndex, this.buildNode)
    } else {
      this.buildSvc.selectProp(obj, this.buildNode)
    }
  }

  private stepPlayerPosition(
    oldPosition: Vector3,
    delta: Vector3,
    originalDelta: Vector3
  ): boolean {
    const newPosition = oldPosition.clone().add(delta)

    this.playerCollider.copyPos(newPosition)
    this.boxMaterial?.color.setHex(0x00ff00)

    let climbHeight = null
    let minHeight = null
    let boxCollision = false
    let feetCollision = false
    // Terrain is not being checked for collision yet
    let checkTerrain = 0

    this.playerOnFloor = false

    const intersectsTriangle = (tri: Triangle) => {
      // Check if the triangle is intersecting the boundingBox and later adjust the
      // boundingBox position if it is.

      const collision = this.playerCollider.topBoxIntersectsTriangle(tri)
      const rayIntersectionPoint =
        this.playerCollider.raysIntersectTriangle(tri)

      feetCollision = this.playerCollider.bottomBoxIntersectsTriangle(tri)

      if (collision) {
        boxCollision = true
        this.boxMaterial?.color.setHex(0xff0000)
      }

      if (
        rayIntersectionPoint != null &&
        // Add terrain offset if needed
        rayIntersectionPoint.y + checkTerrain * this.terrain.position.y >
          newPosition.y
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

    // We expect maximum 9 LODs to be available to test collision: the one the player
    // stands in and the 8 neighbouring ones (sides and corners)
    for (const lod of this.getNearestChunks()) {
      const lodOffset = lod.position
      this.playerCollider.translate(lodOffset.negate())
      this.playerCollider.checkBoundsTree(
        lod.userData.boundsTree,
        intersectsTriangle
      )
      this.playerCollider.translate(lodOffset.negate())
    }

    // Since the pages are centered, we need to add an offset
    const centerOffset = (TERRAIN_PAGE_SIZE * 10) / 2
    const pageX: number = Math.floor(
      (newPosition.x + centerOffset) / (TERRAIN_PAGE_SIZE * 10)
    )
    const pageZ: number = Math.floor(
      (newPosition.z + centerOffset) / (TERRAIN_PAGE_SIZE * 10)
    )
    const terrainPage = this.terrain?.getObjectByName(
      `${pageX}_${pageZ}`
    ) as Mesh

    if (climbHeight == null && terrainPage != null) {
      // Terrain is now being checked for collision
      checkTerrain = 1
      const pageOffset = terrainPage.position
        .clone()
        .setY(this.terrain.position.y)
      this.playerCollider.translate(pageOffset.negate())
      this.playerCollider.checkBoundsTree(
        terrainPage.geometry.boundsTree,
        intersectsTriangle
      )
      this.playerCollider.translate(pageOffset.negate())
    }

    if (boxCollision) {
      this.playerVelocity.set(0, 0, 0)
      this.playerCollider.copyPos(oldPosition)
      this.player.position.copy(oldPosition)
      return false
    }

    if (this.playerVelocity.y <= 0 && climbHeight !== null) {
      // Player is on floor
      this.playerVelocity.setY(0)
      // Add terrain offset if needed
      climbHeight += checkTerrain * this.terrain.position.y
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
      this.playerVelocity.setY(0)
      newPosition.setY(minHeight - playerGroundAdjust)
    }

    if (
      climbHeight === null &&
      feetCollision &&
      newPosition.y + playerGroundAdjust < oldPosition.y
    ) {
      // Prevent the player from falling in a small gap
      this.playerVelocity.setY(0)
      newPosition.setY(oldPosition.y)
    }

    if (feetCollision) {
      this.flyMode = false
      if (originalDelta.y < 0) {
        originalDelta.setY(0)
      }
    }

    this.playerCollider.copyPos(newPosition)
    this.player.position.copy(newPosition)

    return true
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

        if (this.inWater()) {
          this.userState = Math.abs(velocity) > 0.5 ? 'swim' : 'float'
        } else if (this.flyMode) {
          this.userState = Math.abs(velocity) > 0.5 ? 'fly' : 'hover'
        } else if (this.playerVelocity.y < 0) {
          this.userState = 'fall'
        } else if (Math.abs(velocity) > 5.5) {
          this.userState = 'run'
        } else if (Math.abs(velocity) > 0.1) {
          this.userState = 'walk'
        }

        const gestureVelocity = this.inputSysSvc.controls[PressedKey.moveBck]
          ? -velocity
          : velocity

        // When applicable: reset gesture on completion
        this.userGesture = animation.animate(
          this.deltaSinceLastFrame,
          this.userState,
          this.userGesture,
          gestureVelocity
        )
          ? null
          : this.userGesture
      }
    )

    if (!this.inputSysSvc.controls[PressedKey.clip] && this.playerCollider) {
      let deltaLength = deltaPosition.length()

      for (let i = 0; deltaLength > 0 && i < playerMaxNbSteps; i++) {
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
      this.player.position.y + boxHeight / 2,
      this.player.position.z
    )

    if (this.player.position.y < -350) {
      this.playerVelocity.set(0, 0, 0)
      this.player.position.y = 0
    }

    this.inWater.set(
      this.water != null && this.water.position.y >= this.cameraPosition.y
    )

    if (
      Math.abs(this.playerPosition().x - this.player.position.x) > 1e-3 ||
      Math.abs(this.playerPosition().y - this.player.position.y) > 1e-3 ||
      Math.abs(this.playerPosition().z - this.player.position.z) > 1e-3
    ) {
      this.playerPosition.set(this.player.position.clone())
      this.rotateSprites()
      this.updateLODs()
    }
  }

  private updatePointLights() {
    const seen = []
    this.litObjects.forEach((obj) => {
      const objPos = obj.position.clone().add(obj.parent.parent.position)
      seen.push({
        dist: this.player.position.distanceTo(objPos),
        obj: obj,
        pos: objPos
      })
    })

    seen.sort((a, b) => a.dist - b.dist)
    const toLit = seen.slice(0, this.pointLights.length)

    this.pointLights.forEach((light, index) => {
      light.position.set(0, 0, 0)
      light.intensity = 0
      light.decay = 0.2
      light.distance = 0.01
      light.color.set(0xffffff)
      light.castShadow = false

      const prop = toLit[index]
      if (prop?.obj == null) {
        return
      }
      let fx = 1
      switch (prop.obj.userData.light?.fx) {
        case 'fire':
          fx = Math.random() * (1.2 - 0.8) + 0.8
          break
        case 'pulse':
          const power = (Date.now() / 1000) % 1
          fx = Math.sin(power * Math.PI)
          break
        case 'flash':
          fx = Math.random() > 0.02 ? 0 : 1
          break
        case 'flicker':
          fx = Math.random() > 0.02 ? 1 : 0
          break
        default:
          break
      }
      if (prop.obj.userData.corona?.visible) {
        prop.obj.userData.corona.material.opacity = fx
      }
      light.position.set(prop.pos.x, prop.pos.y, prop.pos.z)
      light.color.set(prop.obj.userData.light.color)
      light.intensity = 2.5 * fx * (prop.obj.userData.light.brightness || 0.5)
      light.distance = prop.obj.userData.light.radius || 10
    })
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
      this.rotateSprites()
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
      this.rotateSprites()
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
    this.activeCamera.getWorldPosition(this.cameraPosition)

    this.skybox.position.copy(this.player.position)
    this.dirLight?.position.set(
      -50 + this.player.position.x,
      80 + this.player.position.y,
      10 + this.player.position.z
    )

    if (this.frameId % 10 === 0) {
      // Skip some frames because this causes heavy
      // raycasting just to check corona visibility
      this.objectsNode
        .getObjectsByProperty('name', 'corona')
        .filter((corona: Sprite) => corona.parent.parent.visible)
        .forEach((corona: Sprite) => {
          corona.visible = this.isCoronaVisible(corona)
        })
    }

    // compass
    this.compass.setFromVector3(this.cameraDirection)
    this.compassSub.next({
      pos: new Vector3(
        Math.round(this.player.position.x * 100) / 100,
        Math.round(this.player.position.y * 100) / 100,
        Math.round(this.player.position.z * 100) / 100
      ),
      theta: this.yaw
    })
  }

  private animateItems() {
    for (const item of this.animatedObjects) {
      this.propAnimSvc.moveItem(item, this.deltaSinceLastFrame)
      this.propAnimSvc.rotateIem(item, this.deltaSinceLastFrame)
      item.updateMatrix()
    }
  }

  private moveUsers() {
    this.userSvc
      .userList()
      .filter((u) => this.usersNode.getObjectByName(u.id))
      .forEach((u) => {
        const user = this.usersNode.getObjectByName(u.id)
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
        // Labels
        const div = this.labelMap.get(user.name)
        if (div == null) {
          return
        }
        div.position.copy(user.position)
        div.position.y +=
          user.userData.height > 1.1
            ? user.userData.height / 2
            : user.userData.height
      })
  }

  private rotateSprites() {
    for (const item of this.sprites) {
      item.rotation.y = this.player.rotation.y
      item.updateMatrix()
    }
  }

  private isCoronaVisible(corona: Sprite) {
    const cameraPosition = this.activeCamera.getWorldPosition(new Vector3())
    const spritePosition = corona.getWorldPosition(new Vector3())
    const cameraToSpriteDirection = new Vector3()
      .subVectors(spritePosition, cameraPosition)
      .normalize()

    this.raycaster.set(cameraPosition, cameraToSpriteDirection)

    // Ignore the current prop during raycasting to prevent self-intersection
    const ignoreList = [corona, corona.parent]
    const intersects = this.raycaster
      .intersectObjects(
        this.objectsNode.children.concat(this.terrain ?? []),
        true
      )
      .filter((intersect) => !ignoreList.includes(intersect.object))

    const closestIntersection = intersects[0]

    // Check if there is an intersection and it is in front of the sprite
    return (
      !closestIntersection ||
      closestIntersection.distance >= cameraPosition.distanceTo(spritePosition)
    )
  }
}
