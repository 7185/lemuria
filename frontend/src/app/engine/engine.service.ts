import type {ElementRef} from '@angular/core'
import type {DirectionalLight, LOD, Sprite, Vector3Like} from 'three'
import {inject, Service, signal} from '@angular/core'
import {toObservable} from '@angular/core/rxjs-interop'
import {fromEvent, timer} from 'rxjs'
import {
  Box3,
  BufferGeometry,
  Cache,
  Color,
  Euler,
  Fog,
  Group,
  Mesh,
  Object3D,
  PerspectiveCamera,
  PointLight,
  Raycaster,
  Scene,
  Spherical,
  SRGBColorSpace,
  Timer,
  Vector2,
  Vector3,
  WebGLRenderer
} from 'three'
import {
  acceleratedRaycast,
  computeBoundsTree,
  disposeBoundsTree
} from 'three-mesh-bvh'
import {
  CSS2DObject,
  CSS2DRenderer
} from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import type {AvatarAnimationPlayer} from '../animation'
import type {PropCtl} from '../world/prop.service'
import type {PressedKey} from './inputsystem.service'
import {environment} from '../../environments/environment'
import {PropAnimationService} from '../animation'
import {UserService} from '../user'
import {DEG, ZERO_VEC} from '../utils/constants'
import {
  disposeGroupGeometries,
  disposeGroupMaterials,
  getMeshes,
  radNormalized,
  shortestAngle
} from '../utils/utils'
import {PropActionService} from '../world/prop-action.service'
import {PropService} from '../world/prop.service'
import {AudioService} from './audio.service'
import {BuildService} from './build.service'
import {InputSystemService} from './inputsystem.service'
import {Player} from './player'

// Faster raycasting using BVH
BufferGeometry.prototype.computeBoundsTree = computeBoundsTree
BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree
Mesh.prototype.raycast = acceleratedRaycast

// Don't update matrix for props that are out of visibility range to speed up
// the render loop
const _updateMatrixWorld = Object3D.prototype.updateMatrixWorld
Object3D.prototype.updateMatrixWorld = function () {
  if (this.name.endsWith('.rwx') && !this.parent?.visible) {
    return
  }
  _updateMatrixWorld.call(this)
}

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

const lightFxMap: Record<string, (now: number, rnd: number) => number> = {
  fire: (_, rnd) => rnd * 0.4 + 0.8,
  pulse: (now) => Math.sin(((now / 1000) % 1) * Math.PI),
  flash: (_, rnd) => +(rnd <= 0.02),
  flicker: (_, rnd) => +(rnd > 0.02)
}

@Service()
export class EngineService {
  compassSignal = signal({pos: {x: 0, y: 0, z: 0}, theta: 0})
  fps = signal(0)
  maxFps = signal(60)
  maxLights = signal(6)
  texturesAnimation = signal(0)
  playerPosition = signal({x: 0, y: 0, z: 0})
  worldFog = {color: 0x00007f, near: 0, far: 120, enabled: false}

  private readonly userSvc = inject(UserService)
  private readonly inputSysSvc = inject(InputSystemService)
  private readonly audioSvc = inject(AudioService)
  private readonly propSvc = inject(PropService)
  private readonly buildSvc = inject(BuildService)
  private readonly propAnimSvc = inject(PropAnimationService)
  private readonly propActionSvc = inject(PropActionService)

  private terrain: Group
  private water: Group
  private chunkLODMap = new Map<string, LOD>()
  private compass = new Spherical()
  private canvas: HTMLCanvasElement
  private labelZone: HTMLDivElement
  private renderer: WebGLRenderer
  private labelRenderer: CSS2DRenderer
  private labelMap = new Map<string, CSS2DObject>()
  private timer: Timer
  private camera: PerspectiveCamera
  private thirdCamera: PerspectiveCamera
  private thirdFrontCamera: PerspectiveCamera
  private activeCamera: PerspectiveCamera
  private cameras: PerspectiveCamera[]
  private lodCamera: PerspectiveCamera
  private scene: Scene
  private buildScene: Scene
  private labelScene: Scene
  private dirLight: DirectionalLight
  private fog = new Fog(0)
  private skybox: Group
  private hoveredObject: Group
  private player = new Player()

  private frameId: number = null
  private coronaFrameCount = 0
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
  private sprites = new Set<Group>()
  private coronaObjects = new Set<Group>()
  private animatedObjects = new Set<Group>()
  private litObjects = new Set<Group>()
  private sonicObjects = new Set<Group>()
  private bumpObjects = new Set<Group>()
  private bumpedObjects = new Set<Group>()
  private pointLights: PointLight[] = []

  private mouseIdle = 0
  private pointerDirty = true
  private lastPointedProp: Group | null = null
  private labelDesc: HTMLDivElement | undefined

  private chunkTile: [number, number] = [0, 0]

  private keyControlMap = new Map<PressedKey, PropCtl>([
    ['moveFwd', 'forward'],
    ['turnRgt', 'right'],
    ['moveRgt', 'right'],
    ['moveBck', 'backward'],
    ['turnLft', 'left'],
    ['moveLft', 'left'],
    ['lookUp', 'rotY'],
    ['lookDwn', 'rotnY'],
    ['moveUp', 'up'],
    ['moveDwn', 'down'],
    // ['divide', 'rotX'],
    // ['multiply', 'rotnX'],
    // ['home', 'rotZ'],
    // ['end', 'rotnZ'],
    ['esc', 'deselect'],
    ['cpy', 'copy'],
    ['del', 'delete']
  ])

  private spriteRotation = new Euler(0, 0, 0, 'YXZ')
  private spriteRotationXYZ = new Euler(0, 0, 0, 'YXZ')

  private tmpPosCache = new Vector3()
  private tmpRotCache = new Vector3()
  private tmpPositionTuple: [Vector3, Vector3] = [ZERO_VEC, ZERO_VEC]
  private tmpObjPos = new Vector3()
  private tmpPrevUserPos = new Vector3()
  private tmpSpritePos = new Vector3()
  private tmpCamToSprite = new Vector3()
  private tmpPlayerBumpBox = new Box3()
  private tmpPropBumpBox = new Box3()

  constructor() {
    this.raycaster.firstHitOnly = true
    toObservable(this.maxLights).subscribe((lights) =>
      this.refreshLights(lights)
    )
    toObservable(this.player.inWater).subscribe(() => this.updateFog())
  }

  cancel(): void {
    if (this.frameId != null) {
      cancelAnimationFrame(this.frameId)
    }
    this.renderer?.dispose()
    this.renderer?.forceContextLoss()
    this.renderer = null
    this.canvas = null
  }

  createScene(
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
    this.renderer.setPixelRatio(globalThis.devicePixelRatio)
    this.renderer.setSize(globalThis.innerWidth, globalThis.innerHeight)
    this.renderer.shadowMap.enabled = false
    this.renderer.outputColorSpace = SRGBColorSpace
    this.renderer.autoClear = false
    this.renderer.info.autoReset = false
    if (!environment.debug) {
      this.renderer.debug.checkShaderErrors = false
    }
    this.labelRenderer = new CSS2DRenderer({element: this.labelZone})
    this.labelRenderer.setSize(globalThis.innerWidth, globalThis.innerHeight)

    this.scene = new Scene()
    this.buildScene = new Scene()
    this.labelScene = new Scene()

    this.worldNode.add(this.player.entity)

    this.camera = new PerspectiveCamera(
      50,
      globalThis.innerWidth / globalThis.innerHeight,
      0.1,
      1000
    )
    this.camera.rotation.order = 'YXZ'
    this.camera.position.setY(0)
    this.lodCamera = this.camera.clone()
    this.scene.add(this.lodCamera)
    this.player.entity.attach(this.camera)

    this.thirdCamera = new PerspectiveCamera(
      50,
      globalThis.innerWidth / globalThis.innerHeight,
      0.1,
      1000
    )
    this.thirdCamera.rotation.order = 'YXZ'
    this.thirdCamera.position.setZ(6)
    this.thirdCamera.position.setY(0.2)
    this.camera.attach(this.thirdCamera)

    this.thirdFrontCamera = new PerspectiveCamera(
      50,
      globalThis.innerWidth / globalThis.innerHeight,
      0.1,
      1000
    )
    this.thirdFrontCamera.rotation.order = 'YXZ'
    this.thirdFrontCamera.position.setZ(-6)
    this.thirdFrontCamera.position.setY(0.2)
    this.thirdFrontCamera.rotation.y = Math.PI
    this.camera.attach(this.thirdFrontCamera)

    this.audioSvc.addListener(this.camera)

    this.cameras = [this.camera, this.thirdCamera, this.thirdFrontCamera]
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

  clearObjects() {
    this.buildSvc.deselectCell()
    this.buildSvc.deselectProp()
    this.bumpObjects.clear()
    this.bumpedObjects.clear()
    this.lastPointedProp = null
    this.pointerDirty = true
    // Children is a dynamic iterable, we need a copy to get all of them
    for (const prop of [...this.objectsNode.children]) {
      this.removeObject(prop as Group)
    }
    this.sprites.clear()
    this.coronaObjects.clear()
    this.animatedObjects.clear()
    // Turn off the lights
    this.litObjects.clear()
    this.updatePointLights()
    this.sonicObjects.clear()
    this.updateSound()
  }

  clearScene() {
    this.clearObjects()
    this.scene.traverse((child: Object3D) => {
      disposeGroupGeometries(child as Group)
      disposeGroupMaterials(child as Group)
    })
    // Outside of traverse because the children size might change
    for (const child of this.scene.children) {
      child.parent.remove(child)
    }
  }

  updateBoundingBox(height?: number) {
    const boxHeight =
      height ??
      (this.player.avatar.userData.height as number | undefined) ??
      1.7
    this.player.resetCollider(boxHeight)

    if (!environment.debug) {
      return
    }

    for (const prop of this.worldNode.children.filter(
      (i) => i.name === 'boundingBox'
    )) {
      disposeGroupMaterials(prop as Group)
      this.worldNode.remove(prop)
    }
    this.player.collider.createBoundingBox(boxHeight, this.player.position)
    this.worldNode.add(this.player.collider.colliderBox)
  }

  get position(): [Vector3, Vector3] {
    if (this.player) {
      this.tmpPosCache.copy(this.player.position)
      this.tmpRotCache.setFromEuler(this.player.rotation)
      this.tmpPositionTuple[0] = this.tmpPosCache
      this.tmpPositionTuple[1] = this.tmpRotCache
    } else {
      this.tmpPositionTuple[0] = ZERO_VEC
      this.tmpPositionTuple[1] = ZERO_VEC
    }
    return this.tmpPositionTuple
  }

  get gravity(): number {
    return this.player.gravity
  }

  set gravity(value: number) {
    this.player.gravity = Number.isFinite(value) ? value : 1
  }

  get yaw(): number {
    return Math.round(this.compass.theta / DEG)
  }

  get viewDirection(): {x: number; z: number} {
    const len = Math.hypot(this.cameraDirection.x, this.cameraDirection.z)
    if (len > 1e-3) {
      return {x: this.cameraDirection.x / len, z: this.cameraDirection.z / len}
    }
    return {x: 0, z: -1}
  }

  set gesture(gesture: string) {
    this.player.gesture = gesture
  }

  get gesture(): string {
    return this.player.gesture
  }

  get state(): string {
    return this.player.state
  }

  set currentChunk(tile: [number, number]) {
    this.chunkTile = tile
  }

  get currentChunk(): [number, number] {
    return this.chunkTile
  }

  updateFog() {
    if (this.player.inWater()) {
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

  get avatar(): Group {
    return this.player.avatar
  }

  setCameraOffset(offset: number) {
    this.camera.position.setY(offset)
  }

  addChunk(chunk: LOD) {
    chunk.matrixAutoUpdate = false
    this.objectsNode.add(chunk)
    chunk.updateMatrix()
    this.updateLODs(chunk)
    this.chunkLODMap.set(
      `${chunk.userData.world.chunk.x}_${chunk.userData.world.chunk.z}`,
      chunk
    )
    this.pointerDirty = true
  }

  setChunksDistance(meters: number) {
    for (const chunk of this.objectsNode.children as LOD[]) {
      chunk.levels[0].distance = meters
      chunk.levels[1].distance = meters + 1
    }
  }

  addWorldObject(obj: Object3D) {
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

  addUser(group: Group) {
    const user = this.userSvc.getUser(group.name)
    const div = document.createElement('div')
    div.className = 'text-label'
    div.textContent = user?.name ?? ''

    const label = new CSS2DObject(div)
    this.labelMap.set(group.name, label)
    this.labelScene.add(label)
    this.usersNode.add(group)
  }

  setSkybox(skybox: Group) {
    if (!this.skybox) {
      return
    }
    disposeGroupMaterials(this.skybox)
    disposeGroupGeometries(this.skybox)
    this.skybox.clear()
    this.skybox.add(skybox)
  }

  removeObject(group: Group) {
    if (group === this.buildSvc.selectedProp()) {
      this.buildSvc.deselectProp()
    }
    this.handleHiddenProp(group)
    disposeGroupMaterials(group)
    disposeGroupGeometries(group)

    const chunk = group.parent as Group
    chunk.remove(group)
    if (chunk.userData.bvhUpdate) {
      // Regenerate boundsTree
      chunk.userData.bvhUpdate.next()
    }
    this.pointerDirty = true
  }

  removeLight(light: PointLight) {
    light.parent?.remove(light)
    light.dispose()
  }

  refreshLights(length: number) {
    if (this.scene == null) {
      return
    }

    while (this.pointLights.length > length) {
      const light = this.pointLights.pop()!
      this.removeLight(light)
    }
    while (this.pointLights.length < length) {
      const light = new PointLight(0, 0)
      this.pointLights.push(light)
      this.scene.add(light)
    }
  }

  removeWorldObject(group: Group) {
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
    disposeGroupMaterials(group)
    disposeGroupGeometries(group)

    group.parent?.remove(group)
  }

  removeUser(group: Group) {
    const label = this.labelMap.get(group.name)
    if (label != null) {
      this.labelScene.remove(label)
    }
    disposeGroupMaterials(group)
    disposeGroupGeometries(group)
    this.usersNode.remove(group)
  }

  users(): Group[] {
    return this.usersNode.children as Group[]
  }

  getMemInfo(): [{geometries: number; textures: number}, number] {
    if (this.renderer == null) {
      return [{geometries: 0, textures: 0}, 0]
    }
    return [this.renderer.info.memory, this.renderer.info.render.calls]
  }

  animate(): void {
    this.timer = new Timer()
    this.timer.connect(document)
    if (document.readyState === 'loading') {
      fromEvent(globalThis, 'DOMContentLoaded').subscribe(() => this.render())
    } else {
      this.render()
    }
    fromEvent(globalThis, 'resize').subscribe(() => this.resize())
    fromEvent(this.canvas, 'contextmenu').subscribe((e: MouseEvent) =>
      this.rightClick(e)
    )
    fromEvent(this.canvas, 'mousemove').subscribe((e: MouseEvent) => {
      this.mouseIdle = 0
      this.pointerDirty = true
      this.mouse.x = (e.clientX / globalThis.innerWidth) * 2 - 1
      this.mouse.y = -(e.clientY / globalThis.innerHeight) * 2 + 1
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
        const ctl =
          this.keyControlMap.get(this.inputSysSvc.getKey(k.code)) || 'nop'
        this.propSvc.propControl.next(ctl)
      }
    })
    this.inputSysSvc.keyUpEvent.subscribe(() => {
      this.mouseIdle = 0
    })
    this.propSvc.propControl.subscribe((act: PropCtl) => {
      if (!this.buildSvc.buildMode) {
        return
      }
      if (this.buildSvc.selectedCell().page != null) {
        this.buildSvc.cellControl.next({
          action: act,
          cameraDirection: this.cameraDirection
        })
        return
      }
      if (act === 'delete') {
        // Remove prop from scene and do nothing else
        this.removeObject(this.buildSvc.selectedProp())
        return
      }
      // Handle prop moving and duplication
      this.buildSvc.moveProp(act, this.cameraDirection)
    })
    timer(0, 100).subscribe(() => {
      this.mouseIdle++
      if (this.pointerDirty) {
        this.pointerDirty = false
        this.lastPointedProp = this.pointedProp().obj
        document.body.style.cursor =
          this.lastPointedProp?.userData?.activate != null
            ? 'pointer'
            : 'default'
      }
      const prop = this.lastPointedProp
      if (this.mouseIdle >= 10) {
        if (prop !== this.hoveredObject) {
          this.labelDesc.style.display = 'none'
          this.hoveredObject = prop
          if (prop?.userData?.desc) {
            this.labelDesc.style.display = 'block'
            this.labelDesc.innerHTML = prop.userData.desc.replace(
              // eslint-disable-next-line no-control-regex
              /[\u0000-\u002F\u003A-\u0040\u005B-\u0060\u007B-\u00FF]/g,
              (c: string) => '&#' + `000${c.charCodeAt(0)}`.slice(-4) + ';'
            )
            this.labelDesc.style.left =
              ((this.mouse.x + 1) / 2) * globalThis.innerWidth + 'px'
            this.labelDesc.style.top =
              (-(this.mouse.y - 1) / 2) * globalThis.innerHeight + 'px'
          }
        }
        this.mouseIdle = 5
      }
    })
  }

  setCamera(cameraType: number) {
    if (this.cameras != null) {
      this.activeCamera = this.cameras[cameraType]
    }
    this.player.avatar.visible = this.activeCamera !== this.camera
    this.pointerDirty = true
  }

  setPlayerPos(pos: Vector3Like | string, yaw = 0): void {
    this.player.setPos(pos, yaw)
    this.player.entity.updateMatrixWorld()
    this.activeCamera?.getWorldDirection(this.cameraDirection)
  }

  setPlayerYaw(yaw: number) {
    this.player.setYaw(yaw)
  }

  getLODs(): LOD[] {
    return this.objectsNode.children as LOD[]
  }

  resetChunkLODMap() {
    this.chunkLODMap.clear()
  }

  getNearestChunks(): LOD[] {
    return nearestChunkPattern
      .map((offset) =>
        this.chunkLODMap.get(
          `${this.currentChunk[0] + offset.x}_${
            this.currentChunk[1] + offset.z
          }`
        )
      )
      .filter((lod) => lod !== undefined)
  }

  private handleHiddenProp(group: Group) {
    this.sprites.delete(group)
    this.coronaObjects.delete(group)
    this.animatedObjects.delete(group)
    this.litObjects.delete(group)
    this.sonicObjects.delete(group)
    this.bumpObjects.delete(group)
    this.bumpedObjects.delete(group)
    delete group.userData.bumpBox
  }

  private handleShownProp(group: Group) {
    const axisAlignment = group.userData.rwx?.axisAlignment
    if (axisAlignment != null && axisAlignment !== 'none') {
      this.sprites.add(group)
      this.alignSprite(group, axisAlignment)
    }
    if (group.userData.corona != null) {
      this.coronaObjects.add(group)
    }
    if (
      group.userData.animation?.rotate != null ||
      group.userData.animation?.move != null
    ) {
      this.animatedObjects.add(group)
    }
    if (group.userData.light != null) {
      this.litObjects.add(group)
    }
    if (group.userData.sound != null) {
      this.sonicObjects.add(group)
    }
    if (group.userData.bump != null) {
      this.bumpObjects.add(group)
      delete group.userData.bumpBox
    } else {
      this.bumpObjects.delete(group)
      this.bumpedObjects.delete(group)
      delete group.userData.bumpBox
    }
    if (group.userData.notSolid === true && group.parent?.parent?.visible) {
      // Regenerate boundsTree
      group.parent.userData.bvhUpdate.next()
    }
  }

  /**
   * Update LODs
   * @param newChunk Optional parameter if the chunk is new
   */
  private updateLODs(newChunk: LOD | null = null) {
    // We trick the LOD into acting like the camera is always on the ground,
    // this avoids having chunks disappearing if we get too high/far on the Y axis
    this.lodCamera.position.set(
      this.player.position.x,
      0,
      this.player.position.z
    )
    this.lodCamera.rotation.copy(this.player.rotation)
    this.lodCamera.updateMatrix()

    for (const lod of this.objectsNode.children as LOD[]) {
      const oldLevel = lod.getCurrentLevel()
      lod.update(this.lodCamera)
      const newLevel = lod.getCurrentLevel()

      if (oldLevel === newLevel && lod != newChunk) {
        continue
      }
      if (newLevel === 0) {
        // We display a previously hidden chunk
        const chunk = lod.levels[0].object
        chunk.children.forEach((child: Object3D) => {
          child.userData.onShow(() => {
            this.handleShownProp(child as Group)
          })
          child.userData.onUpdate = () => this.handleShownProp(child as Group)
        })
        if (!lod.visible) {
          chunk.userData.bvhInit?.()
        }
      } else {
        // The chunk is being hidden
        lod.levels[0].object.children.forEach((child: Object3D) => {
          child.userData.onHide(() => {
            this.handleHiddenProp(child as Group)
          })
          child.userData.onUpdate = () => Function.prototype
        })
      }
    }
  }

  private render(): void {
    this.frameId = requestAnimationFrame(() => this.render())

    this.timer.update()
    this.deltaFps += this.timer.getDelta()

    if (this.deltaFps <= 1 / this.maxFps()) {
      return
    }
    this.fps.set(Math.round(1 / this.deltaFps))
    this.deltaSinceLastFrame = Math.min(this.deltaFps, 0.1)
    this.deltaFps = (this.deltaFps % 1) / this.maxFps()
    this.renderer.clear()
    this.renderer.info.reset()
    this.renderer.render(this.scene, this.activeCamera)
    this.labelRenderer.render(this.labelScene, this.activeCamera)
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
      this.animateProps()
      this.updatePointLights()
      this.updateSound()
    }

    this.moveUsers()
  }

  private resize(): void {
    const width = globalThis.innerWidth
    const height = globalThis.innerHeight

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

  private pointedProp() {
    this.raycaster.setFromCamera(this.mouse, this.activeCamera)
    const targets: Object3D[] = []
    for (const lod of this.objectsNode.children as LOD[]) {
      const chunk = lod.levels[0]?.object
      if (chunk?.visible) {
        targets.push(chunk)
      }
    }
    if (this.terrain != null) {
      targets.push(this.terrain)
    }
    const intersects = this.raycaster.intersectObjects(targets, true)
    for (const i of intersects) {
      let obj = i.object
      while (
        obj.parent !== this.terrain &&
        !obj.parent!.userData.world?.chunk
      ) {
        obj = obj.parent!
      }
      if (
        obj.name.endsWith('.rwx') &&
        obj.parent!.visible &&
        !obj?.userData?.notVisible
      ) {
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
    if (this.buildSvc.selectedCell().page != null) {
      this.buildSvc.deselectCell()
      // Left click to exit buildMode, do nothing else
      return
    }
    if (this.buildSvc.selectedProp() != null) {
      this.buildSvc.deselectProp()
      // Left click to exit buildMode, do nothing else
      return
    }
    const prop = this.pointedProp().obj
    const activate = prop?.userData?.activate
    if (activate == null) {
      return
    }

    if (activate.teleport != null) {
      this.propActionSvc.teleportPlayer(
        activate.teleport,
        this.player.position,
        this.yaw
      )
    }

    prop?.userData.onClick(() => {
      // Needed since the prop's state might have just changed
      this.handleShownProp(prop)
    })
  }

  private rightClick(event: MouseEvent) {
    event.preventDefault()
    const {obj, faceIndex} = this.pointedProp()
    if (obj == null) {
      return
    }
    if (obj.parent?.name === 'terrain') {
      this.buildSvc.selectCell(obj, faceIndex, this.buildNode)
    } else {
      this.buildSvc.selectProp(obj, this.buildNode)
    }
  }

  private checkBumps() {
    if (this.bumpObjects.size === 0 || this.player.collider == null) {
      return
    }
    if (this.inputSysSvc.controls['clip']) {
      this.bumpedObjects.clear()
      return
    }

    const halfSide = environment.world.collider.boxSide / 2 + 0.05
    const pos = this.player.position
    this.tmpPlayerBumpBox.min.set(
      pos.x - halfSide,
      pos.y - 0.05,
      pos.z - halfSide
    )
    this.tmpPlayerBumpBox.max.set(
      pos.x + halfSide,
      pos.y + this.player.collider.boxHeight,
      pos.z + halfSide
    )

    for (const prop of this.bumpObjects) {
      if (prop.parent == null || !prop.parent.visible) {
        this.bumpedObjects.delete(prop)
        continue
      }
      let propBox = prop.userData.bumpBox as Box3 | undefined
      const isMoving = prop.userData.animation?.move != null
      if (propBox == null || isMoving) {
        this.tmpPropBumpBox.setFromObject(prop)
        if (!isMoving) {
          propBox = this.tmpPropBumpBox.clone()
          prop.userData.bumpBox = propBox
        } else {
          propBox = this.tmpPropBumpBox
        }
      }
      if (this.tmpPlayerBumpBox.intersectsBox(propBox)) {
        if (!this.bumpedObjects.has(prop)) {
          this.bumpedObjects.add(prop)
          this.triggerBump(prop)
          if (prop.userData.bump?.teleport != null) {
            break
          }
        }
      } else {
        this.bumpedObjects.delete(prop)
      }
    }
  }

  private triggerBump(prop: Group) {
    const bump = prop.userData.bump
    if (bump == null) {
      return
    }
    if (bump.teleport != null) {
      this.propActionSvc.teleportPlayer(
        bump.teleport,
        this.player.position,
        this.yaw
      )
    }
    prop.userData.onBump(() => {
      // Needed since the prop's state might have just changed
      this.handleShownProp(prop)
    })
  }

  private updateSound() {
    const heard: {dist: number; obj: Group}[] = []
    this.sonicObjects.forEach((obj) => {
      if (!obj.parent!.visible) {
        return
      }
      this.tmpObjPos.copy(obj.position).add(obj.parent!.parent!.position)
      heard.push({
        dist: this.player.position.distanceToSquared(this.tmpObjPos),
        obj: obj
      })
    })
    heard.sort((a, b) => a.dist - b.dist)
    if (heard.length) {
      this.propActionSvc.makeSound(
        heard[0].obj,
        heard[0].obj.userData.sound,
        Math.max(0, 1 - Math.sqrt(heard[0].dist) / 200)
      )
    } else {
      this.audioSvc.stopSound()
    }
  }

  private updatePointLights() {
    const seen: {dist: number; obj: Group; pos: Vector3Like}[] = []
    this.litObjects.forEach((obj) => {
      this.tmpObjPos.copy(obj.position).add(obj.parent!.parent!.position)
      seen.push({
        dist: this.player.position.distanceToSquared(this.tmpObjPos),
        obj: obj,
        pos: {x: this.tmpObjPos.x, y: this.tmpObjPos.y, z: this.tmpObjPos.z}
      })
    })

    seen.sort((a, b) => a.dist - b.dist)
    const toLit = seen.slice(0, this.pointLights.length)

    const now = Date.now()
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
      const rnd = Math.random()
      const fxFn = lightFxMap[prop.obj.userData.light?.fx]
      const fx = fxFn ? fxFn(now, rnd) : 1
      if (prop.obj.userData.coronaObj?.visible) {
        prop.obj.userData.coronaObj.material.opacity = fx
      }
      light.position.set(prop.pos.x, prop.pos.y, prop.pos.z)
      light.color.set(prop.obj.userData.light?.color ?? 0xffffff)
      light.intensity = 2.5 * fx * (prop.obj.userData.light?.brightness ?? 0.5)
      light.distance = prop.obj.userData.light?.radius ?? 10
    })
  }

  private moveCamera() {
    this.activeCamera.getWorldDirection(this.cameraDirection)
    const reverse = this.activeCamera === this.thirdFrontCamera ? -1 : 1
    this.player.updatePosition(
      this.deltaSinceLastFrame,
      this.cameraDirection,
      reverse,
      this.getNearestChunks(),
      this.terrain
    )
    this.checkBumps()
    if (
      Math.abs(this.playerPosition().x - this.player.position.x) > 1e-3 ||
      Math.abs(this.playerPosition().y - this.player.position.y) > 1e-3 ||
      Math.abs(this.playerPosition().z - this.player.position.z) > 1e-3
    ) {
      this.playerPosition.set({
        x: this.player.position.x,
        y: this.player.position.y,
        z: this.player.position.z
      })
      this.pointerDirty = true
      this.updateLODs()
    }
    this.rotateSprites()
    this.activeCamera.getWorldPosition(this.cameraPosition)
    this.player.inWater.set(this.water?.position.y >= this.cameraPosition.y)

    this.skybox.position.copy(this.player.position)
    this.dirLight?.position.set(
      -50 + this.player.position.x,
      80 + this.player.position.y,
      10 + this.player.position.z
    )

    if (++this.coronaFrameCount % 3 === 0 && this.coronaObjects.size > 0) {
      // Skip some frames because this causes heavy
      // raycasting just to check corona visibility
      this.updateCoronas()
    }

    // compass
    this.compass.setFromVector3(this.cameraDirection)
    this.compassSignal.set({
      pos: {
        x: Math.round(this.player.position.x * 100) / 100,
        y: Math.round(this.player.position.y * 100) / 100,
        z: Math.round(this.player.position.z * 100) / 100
      },
      theta: this.yaw
    })
  }

  private animateProps() {
    for (const prop of this.animatedObjects) {
      this.propAnimSvc.moveProp(prop, this.deltaSinceLastFrame)
      this.propAnimSvc.rotateProp(prop, this.deltaSinceLastFrame)
      prop.updateMatrix()
    }
  }

  private moveUsers() {
    for (const u of this.userSvc.userList()) {
      const user = this.usersNode.getObjectByName(u.id)
      if (user == null) {
        continue
      }
      u.completion = Math.min(1, u.completion + this.deltaSinceLastFrame / 0.2)
      this.tmpPrevUserPos.copy(user.position)
      user.position.set(
        u.oldX + (u.x - u.oldX) * u.completion,
        u.oldY + (u.y - u.oldY) * u.completion,
        u.oldZ + (u.z - u.oldZ) * u.completion
      )
      user.rotation.set(
        u.oldRoll + shortestAngle(u.oldRoll, u.roll) * u.completion,
        u.oldYaw + shortestAngle(u.oldYaw, u.yaw) * u.completion,
        0,
        'YZX'
      )
      const animation: AvatarAnimationPlayer | undefined =
        user.userData.animationPlayer
      // Velocity is 0 if completion is done
      const velocity =
        u.completion < 1
          ? this.tmpPrevUserPos.distanceTo(user.position) /
            this.deltaSinceLastFrame
          : 0
      // Disable gesture if animation is complete
      if (
        animation?.animate(
          this.deltaSinceLastFrame,
          u.state,
          u.gesture,
          velocity
        )
      ) {
        u.gesture = null
      }
      // Labels
      const div = this.labelMap.get(user.name)
      if (div == null) {
        return
      }
      div.position.copy(user.position)
      div.position.y += user.userData.height ?? 0
    }
  }

  private alignSprite(prop: Group, axisAlignment: string) {
    if (axisAlignment === 'xyz') {
      prop.rotation.copy(this.spriteRotationXYZ)
    } else {
      prop.rotation.copy(this.spriteRotation)
    }
    prop.updateMatrix()
  }

  private rotateSprites() {
    const isFrontCam = this.activeCamera === this.thirdFrontCamera
    const targetY = isFrontCam
      ? radNormalized(this.player.rotation.y + Math.PI)
      : this.player.rotation.y
    const targetX = isFrontCam
      ? -this.player.rotation.x
      : this.player.rotation.x

    if (
      this.spriteRotation.y === targetY &&
      this.spriteRotationXYZ.x === targetX
    ) {
      return
    }

    this.spriteRotation.y = targetY
    this.spriteRotationXYZ.set(targetX, targetY, 0)
    this.pointerDirty = true

    for (const prop of this.sprites) {
      this.alignSprite(prop, prop.userData.rwx.axisAlignment)
    }
  }

  private updateCoronas() {
    const targets: Object3D[] = []
    for (const lod of this.objectsNode.children as LOD[]) {
      const chunk = lod.levels[0]?.object
      if (chunk?.visible) {
        targets.push(chunk)
      }
    }
    targets.push(...this.usersNode.children)
    if (this.player.avatar.visible) {
      targets.push(this.player.avatar)
    }
    if (this.terrain != null) {
      targets.push(this.terrain)
    }

    this.raycaster.camera = this.activeCamera

    for (const prop of this.coronaObjects) {
      const corona = prop.userData.coronaObj as Sprite | undefined
      if (corona == null) {
        continue
      }
      corona.visible =
        prop.parent!.visible && this.isCoronaVisible(corona, targets)
    }
  }

  private isCoronaVisible(corona: Sprite, targets: Object3D[]) {
    const spritePosition = corona.getWorldPosition(this.tmpSpritePos)
    this.tmpCamToSprite.subVectors(spritePosition, this.cameraPosition)
    const distance = this.tmpCamToSprite.length()
    if (distance === 0) {
      return true
    }
    this.tmpCamToSprite.divideScalar(distance)

    // Skip raycasting if the corona is behind the camera
    if (this.tmpCamToSprite.dot(this.cameraDirection) <= 0) {
      return false
    }

    this.raycaster.set(this.cameraPosition, this.tmpCamToSprite)
    this.raycaster.far = distance

    // Ignore sprites and the corona's own prop
    const ignoreList = getMeshes(corona.parent!)
    const intersects = this.raycaster
      .intersectObjects(targets, true)
      .filter(
        (intersect) =>
          intersect.object instanceof Mesh &&
          !ignoreList.includes(intersect.object)
      )

    this.raycaster.far = Infinity

    const closestIntersection = intersects[0]

    // Check if there is an intersection and it is in front of the sprite
    return !closestIntersection || closestIntersection.distance >= distance
  }
}
