import {fromEvent, timer} from 'rxjs'
import {toObservable} from '@angular/core/rxjs-interop'
import {inject, Injectable, signal} from '@angular/core'
import type {ElementRef} from '@angular/core'
import {
  BufferGeometry,
  Cache,
  Clock,
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
  Vector2,
  Vector3,
  WebGLRenderer
} from 'three'
import {
  CSS2DObject,
  CSS2DRenderer
} from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import type {DirectionalLight, LOD, Sprite, Vector3Like} from 'three'
import {AudioService} from './audio.service'
import {BuildService} from './build.service'
import {UserService} from '../user'
import type {PropCtl} from '../world/prop.service'
import {PropService} from '../world/prop.service'
import {PropActionService} from '../world/prop-action.service'
import {PropAnimationService} from '../animation'
import type {AvatarAnimationPlayer} from '../animation'
import type {PressedKey} from './inputsystem.service'
import {InputSystemService} from './inputsystem.service'
import {environment} from '../../environments/environment'
import {DEG} from '../utils/constants'
import {getMeshes, radNormalized, shortestAngle} from '../utils/utils'
import {Player} from './player'
import {
  acceleratedRaycast,
  computeBoundsTree,
  disposeBoundsTree
} from 'three-mesh-bvh'

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

@Injectable({providedIn: 'root'})
export class EngineService {
  compassSignal = signal({pos: new Vector3(), theta: 0})
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
  private clock: Clock
  private camera: PerspectiveCamera
  private thirdCamera: PerspectiveCamera
  private thirdFrontCamera: PerspectiveCamera
  private activeCamera: PerspectiveCamera
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
  private animatedObjects = new Set<Group>()
  private litObjects = new Set<Group>()
  private sonicObjects = new Set<Group>()
  private pointLights: PointLight[] = []

  private mouseIdle = 0
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

  private spriteRotation = new Euler()
  private tmpObjPos = new Vector3()
  private tmpPrevUserPos = new Vector3()

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
    this.buildSvc.deselectProp()
    // Children is a dynamic iterable, we need a copy to get all of them
    for (const prop of [...this.objectsNode.children]) {
      this.removeObject(prop as Group)
    }
    this.sprites.clear()
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
      this.disposeGeometry(child as Group)
      this.disposeMaterial(child as Group)
      child.parent?.remove(child)
    })
  }

  updateBoundingBox() {
    const boxHeight = this.camera.position.y * 1.11
    this.player.resetCollider(boxHeight)

    if (!environment.debug) {
      return
    }

    for (const prop of this.worldNode.children.filter(
      (i) => i.name === 'boundingBox'
    )) {
      this.disposeMaterial(prop as Group)
      this.worldNode.remove(prop)
    }
    this.player.collider.createBoundingBox(boxHeight, this.player.position)
    this.worldNode.add(this.player.collider.colliderBox)
  }

  get position(): [Vector3, Vector3] {
    return this.player == null
      ? [new Vector3(), new Vector3()]
      : [this.player.position, new Vector3().setFromEuler(this.player.rotation)]
  }

  get yaw(): number {
    return Math.round(this.compass.theta / DEG)
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
    this.disposeMaterial(this.skybox)
    this.disposeGeometry(this.skybox)
    this.skybox.clear()
    this.skybox.add(skybox)
  }

  disposeGeometry(group: Group) {
    group.traverse((child: Object3D) => {
      if (child instanceof Mesh) {
        child.geometry.dispose()
      }
    })
  }

  disposeMaterial(group: Group) {
    group.traverse((child: Object3D) => {
      if (child instanceof Mesh) {
        for (const m of child.material) {
          m.alphaMap?.dispose()
          m.map?.dispose()
          m.dispose()
        }
      }
    })
  }

  removeObject(group: Group) {
    if (group === this.buildSvc.selectedProp()) {
      this.buildSvc.deselectProp()
    }
    this.handleHiddenProp(group)
    this.disposeMaterial(group)
    this.disposeGeometry(group)

    const chunk = group.parent as Group
    chunk.remove(group)
    if (chunk.userData.bvhUpdate) {
      // Regenerate boundsTree
      chunk.userData.bvhUpdate.next()
    }
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

    this.disposeMaterial(group)
    this.disposeGeometry(group)

    if (group.parent) {
      group.parent.remove(group)
    }
  }

  removeUser(group: Group) {
    const label = this.labelMap.get(group.name)
    if (label != null) {
      this.labelScene.remove(label)
    }
    this.disposeMaterial(group)
    this.disposeGeometry(group)
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
    this.clock = new Clock(true)
    if (document.readyState !== 'loading') {
      this.render()
    } else {
      fromEvent(globalThis, 'DOMContentLoaded').subscribe(() => this.render())
    }
    fromEvent(globalThis, 'resize').subscribe(() => this.resize())
    fromEvent(globalThis, 'visibilitychange').subscribe(() => {
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
      document.body.style.cursor = 'default'
      const prop = this.pointedProp().obj
      if (prop?.userData?.activate != null) {
        document.body.style.cursor = 'pointer'
      }
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
    switch (cameraType) {
      case 0:
        this.activeCamera = this.camera
        break
      case 1:
        this.activeCamera = this.thirdCamera
        break
      case 2:
        this.activeCamera = this.thirdFrontCamera
        break
      default:
        break
    }
    this.player.avatar.visible = this.activeCamera !== this.camera
  }

  setPlayerPos(pos: Vector3Like | string, yaw = 0): void {
    this.player.setPos(pos, yaw)
    this.player.isOnFloor = true
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
    if (this.sprites.has(group)) {
      this.sprites.delete(group)
    }
    if (this.animatedObjects.has(group)) {
      this.animatedObjects.delete(group)
    }
    if (this.litObjects.has(group)) {
      this.litObjects.delete(group)
    }
    if (this.sonicObjects.has(group)) {
      this.sonicObjects.delete(group)
    }
  }

  private handleShownProp(group: Group) {
    if (group.userData.rwx?.axisAlignment !== 'none') {
      this.sprites.add(group)
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
    if (group.userData.notSolid === true) {
      // Regenerate boundsTree
      group.parent!.userData.bvhUpdate.next()
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
        lod.levels[0].object.children.forEach((child: Object3D) => {
          child.userData.onShow(() => {
            this.handleShownProp(child as Group)
          })
          child.userData.onUpdate = () => this.handleShownProp(child as Group)
        })
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

    this.deltaFps += this.clock.getDelta()

    if (this.deltaFps <= 1 / this.maxFps()) {
      return
    }
    this.fps.set(Math.round(1 / this.deltaFps))
    this.deltaSinceLastFrame = this.deltaFps
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
    const intersects = this.raycaster.intersectObjects(
      this.objectsNode.children.concat(this.terrain ?? []),
      true
    )
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
    this.buildSvc.deselectCell()
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
        pos: {x: this.tmpObjPos.x, y: this.tmpObjPos.x, z: this.tmpObjPos.z}
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
          fx = Math.random() * 0.4 + 0.8
          break
        case 'pulse': {
          const power = (Date.now() / 1000) % 1
          fx = Math.sin(power * Math.PI)
          break
        }
        case 'flash':
          fx = +(Math.random() <= 0.02)
          break
        case 'flicker':
          fx = +(Math.random() > 0.02)
          break
        default:
          break
      }
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
    let movSteps = 12 * this.deltaSinceLastFrame
    let rotSteps = 1.5 * this.deltaSinceLastFrame
    const reverse = this.activeCamera === this.thirdFrontCamera ? -1 : 1
    if (this.inputSysSvc.controls['run']) {
      movSteps = this.player.isFlying
        ? 72 * this.deltaSinceLastFrame
        : 24 * this.deltaSinceLastFrame
      rotSteps *= 3
    }
    if (this.inputSysSvc.controls['moveFwd']) {
      this.player.velocity.add({
        x: reverse * movSteps * this.cameraDirection.x,
        y: 0,
        z: reverse * movSteps * this.cameraDirection.z
      })
    }
    if (this.inputSysSvc.controls['moveBck']) {
      this.player.velocity.add({
        x: reverse * movSteps * -this.cameraDirection.x,
        y: 0,
        z: reverse * movSteps * -this.cameraDirection.z
      })
    }
    if (this.inputSysSvc.controls['turnLft']) {
      if (this.inputSysSvc.controls['clip']) {
        this.player.velocity.add({
          x: reverse * movSteps * this.cameraDirection.z,
          y: 0,
          z: reverse * movSteps * -this.cameraDirection.x
        })
      } else {
        this.player.rotation.y = radNormalized(
          this.player.rotation.y + reverse * rotSteps
        )
      }
      this.rotateSprites()
    }
    if (this.inputSysSvc.controls['turnRgt']) {
      if (this.inputSysSvc.controls['clip']) {
        this.player.velocity.add({
          x: reverse * movSteps * -this.cameraDirection.z,
          y: 0,
          z: reverse * movSteps * this.cameraDirection.x
        })
      } else {
        this.player.rotation.y = radNormalized(
          this.player.rotation.y - reverse * rotSteps
        )
      }
      this.rotateSprites()
    }
    if (this.inputSysSvc.controls['moveLft']) {
      this.player.velocity.add({
        x: reverse * movSteps * this.cameraDirection.z,
        y: 0,
        z: reverse * movSteps * -this.cameraDirection.x
      })
    }
    if (this.inputSysSvc.controls['moveRgt']) {
      this.player.velocity.add({
        x: reverse * movSteps * -this.cameraDirection.z,
        y: 0,
        z: reverse * movSteps * this.cameraDirection.x
      })
    }
    if (
      this.inputSysSvc.controls['lookUp'] &&
      this.player.rotation.x < Math.PI / 2
    ) {
      this.player.rotation.x += rotSteps
    }
    if (
      this.inputSysSvc.controls['lookDwn'] &&
      this.player.rotation.x > -Math.PI / 2
    ) {
      this.player.rotation.x -= rotSteps
    }
    if (this.inputSysSvc.controls['moveUp']) {
      this.player.isFlying = true
      this.player.velocity.add({x: 0, y: movSteps, z: 0})
    }
    if (this.inputSysSvc.controls['moveDwn']) {
      this.player.isFlying = true
      this.player.velocity.add({x: 0, y: -movSteps, z: 0})
    }
    if (this.inputSysSvc.controls['jmp'] && this.player.isOnFloor) {
      this.player.position.setY(this.player.position.y + Player.CLIMB_HEIGHT)
    }
    const damping = Math.exp(-3 * this.deltaSinceLastFrame) - 1
    if (this.player.isOnFloor) {
      this.player.velocity.addScaledVector(this.player.velocity, damping)
    } else if (!this.player.isFlying && !this.inputSysSvc.controls['clip']) {
      this.player.velocity.y -= 30 * this.deltaSinceLastFrame
    } else {
      this.player.velocity.addScaledVector(this.player.velocity, damping)
    }

    this.player.updatePosition(
      this.deltaSinceLastFrame,
      this.getNearestChunks(),
      this.terrain
    )
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
      this.rotateSprites()
      this.updateLODs()
    }
    this.player.inWater.set(this.water?.position.y >= this.cameraPosition.y)
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
        .filter((corona: Object3D) => corona.parent!.parent!.visible)
        .forEach((corona: Object3D) => {
          corona.visible = this.isCoronaVisible(corona as Sprite)
        })
    }

    // compass
    this.compass.setFromVector3(this.cameraDirection)
    this.compassSignal.set({
      pos: new Vector3(
        Math.round(this.player.position.x * 100) / 100,
        Math.round(this.player.position.y * 100) / 100,
        Math.round(this.player.position.z * 100) / 100
      ),
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

  private async moveUsers() {
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
      if (user.userData.offsetY != null) {
        // when the avatar is not loaded yet, the position should not be corrected
        user.position.setY(user.position.y + user.userData.offsetY)
      }
      user.rotation.set(
        u.oldRoll + shortestAngle(u.oldRoll, u.roll) * u.completion,
        u.oldYaw + shortestAngle(u.oldYaw, u.yaw) * u.completion,
        0,
        'YZX'
      )
      const animation: Promise<AvatarAnimationPlayer> =
        user.userData.animationPlayer
      // Velocity is 0 if completion is done
      const velocity =
        u.completion < 1
          ? this.tmpPrevUserPos.distanceTo(user.position) /
            this.deltaSinceLastFrame
          : 0
      // Disable gesture if animation is complete
      if (
        (await animation)?.animate(
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
      div.position.y +=
        user.userData.height > 1.1
          ? user.userData.height / 2
          : user.userData.height
    }
  }

  private rotateSprites() {
    this.spriteRotation.y = this.player.rotation.y
    for (const prop of this.sprites) {
      prop.rotation.copy(this.spriteRotation)
      prop.updateMatrix()
    }
  }

  private isCoronaVisible(corona: Sprite) {
    const spritePosition = corona.getWorldPosition(new Vector3())
    const cameraToSpriteDirection = new Vector3()
      .subVectors(spritePosition, this.cameraPosition)
      .normalize()

    this.raycaster.set(this.cameraPosition, cameraToSpriteDirection)

    // Ignore the current prop during raycasting to prevent self-intersection
    const ignoreList = getMeshes(corona.parent!)
    const intersects = this.raycaster
      .intersectObjects(
        this.objectsNode.children
          .filter((obj) => obj.parent!.visible)
          .concat(
            this.usersNode.children,
            this.player.avatar,
            this.terrain ?? []
          ),
        true
      )
      .filter((intersect) => !ignoreList.includes(intersect.object as Mesh))

    const closestIntersection = intersects[0]

    // Check if there is an intersection and it is in front of the sprite
    return (
      !closestIntersection ||
      closestIntersection.distance >=
        this.cameraPosition.distanceTo(spritePosition)
    )
  }
}
