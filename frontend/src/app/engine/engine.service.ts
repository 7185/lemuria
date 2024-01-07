import {BehaviorSubject, fromEvent, Subject, timer} from 'rxjs'
import {effect, Injectable, NgZone, inject, signal} from '@angular/core'
import type {ElementRef} from '@angular/core'
import {
  Cache,
  Clock,
  Fog,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Group,
  Vector2,
  Vector3,
  WebGLRenderer,
  Object3D,
  Spherical,
  Mesh,
  SRGBColorSpace,
  Color,
  PointLight
} from 'three'
import {
  CSS2DObject,
  CSS2DRenderer
} from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import type {DirectionalLight, LOD, Sprite} from 'three'
import {BuildService} from './build.service'
import {TeleportService} from './teleport.service'
import {UserService} from '../user'
import {ObjectAct, ObjectService} from '../world/object.service'
import {PropAnimationService} from '../animation'
import type {AvatarAnimationPlayer} from '../animation'
import {PressedKey, InputSystemService} from './inputsystem.service'
import {environment} from '../../environments/environment'
import {PlayerCollider} from './player-collider'
import {DEG, Utils} from '../utils'
import {Player} from './player'

// Don't update matrix for props that are out of visibility range to speed up
// the render loop
const _updateMatrixWorld = Object3D.prototype.updateMatrixWorld
Object3D.prototype.updateMatrixWorld = function () {
  if (this.name.endsWith('.rwx') && !this.parent.visible) {
    return
  }
  _updateMatrixWorld.apply(this)
}

const getObjectsByUserData = (scene: Object3D, name: string, value: string) => {
  const objs = []
  scene.traverse((node) => {
    if (node.userData[name] === value) {
      objs.push(node)
    }
  })
  return objs
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
  public compassSub: Subject<{pos: Vector3; theta: number}> = new Subject()
  public fpsSub = new BehaviorSubject<string>('0')
  public maxFps = signal(60)
  public maxLights = signal(6)
  public texturesAnimation = signal(0)
  public playerPosition = signal(new Vector3())
  public worldFog = {color: 0x00007f, near: 0, far: 120, enabled: false}

  private ngZone = inject(NgZone)
  private userSvc = inject(UserService)
  private inputSysSvc = inject(InputSystemService)
  private objSvc = inject(ObjectService)
  private buildSvc = inject(BuildService)
  private propAnimSvc = inject(PropAnimationService)
  private teleportSvc = inject(TeleportService)

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
  private scene: Scene
  private buildScene: Scene
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
  private sprites: Set<Group> = new Set()
  private animatedObjects: Set<Group> = new Set()
  private litObjects: Set<Group> = new Set()
  private pointLights: PointLight[] = []

  private mouseIdle = 0
  private labelDesc: HTMLDivElement

  private chunkTile: [number, number] = [0, 0]

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

  public constructor() {
    this.raycaster.firstHitOnly = true
    effect(() => {
      this.refreshLights(this.maxLights())
    })
    effect(() => {
      this.updateFog(this.player.inWater())
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
    this.renderer.info.autoReset = false
    if (!environment.debug) {
      this.renderer.debug.checkShaderErrors = false
    }
    this.labelRenderer = new CSS2DRenderer({element: this.labelZone})
    this.labelRenderer.setSize(window.innerWidth, window.innerHeight)

    this.scene = new Scene()
    this.buildScene = new Scene()

    this.worldNode.add(this.player.entity)

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
    this.player.entity.attach(this.camera)

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
    this.player.resetCollider(boxHeight)

    if (!environment.debug) {
      return
    }

    for (const item of this.worldNode.children.filter(
      (i) => i.name === 'boundingBox'
    )) {
      this.disposeMaterial(item as Group)
      this.worldNode.remove(item)
    }
    this.player.createBoundingBox(boxHeight)
    this.worldNode.add(this.player.colliderBox)
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
    this.player.gesture = gesture
  }

  public get gesture(): string {
    return this.player.gesture
  }

  public get state(): string {
    return this.player.state
  }

  public set currentChunk(tile: [number, number]) {
    this.chunkTile = tile
  }

  public get currentChunk(): [number, number] {
    return this.chunkTile
  }

  public updateFog(inWater = this.player.inWater()) {
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

  public get avatar(): Group {
    return this.player.avatar
  }

  public setCameraOffset(offset: number) {
    this.camera.position.y = offset
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
    this.updateLODs()
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
    if (
      group.userData.animation?.rotate != null ||
      group.userData.animation?.move != null
    ) {
      this.animatedObjects.delete(group)
    }
    if (group.userData.create?.light != null) {
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

  public getMemInfo(): [{geometries: number; textures: number}, number] {
    return [this.renderer.info.memory, this.renderer.info.render.calls]
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
        if (item?.userData?.activate != null) {
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

  public setCamera(cameraType: number) {
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

  public setPlayerPos(pos: Vector3 | string, yaw = 0): void {
    this.player.setPos(pos, yaw)
  }

  public setPlayerYaw(yaw: number) {
    this.player.setYaw(yaw)
  }

  public getLODs(): LOD[] {
    return this.objectsNode.children as LOD[]
  }

  public resetChunkLODMap() {
    this.chunkLODMap.clear()
  }

  public getNearestChunks() {
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

  private handleSpecialObject(group: Group) {
    if (group.userData.rwx?.axisAlignment !== 'none') {
      this.sprites.add(group)
    }
    if (
      group.userData.animation?.rotate != null ||
      group.userData.animation?.move != null
    ) {
      this.animatedObjects.add(group)
    }
    if (group.userData.create?.light != null) {
      this.litObjects.add(group)
    }
  }

  private updateLODs() {
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
    this.renderer.info.reset()
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
    const activate = item?.userData?.activate
    if (activate == null) {
      return
    }

    if (activate.teleport != null) {
      if (activate.teleport.type == null) {
        // No coords, send user to world entry point
        this.teleportSvc.teleport.set({
          world: activate.teleport.worldName,
          position: null,
          isNew: true
        })
      }

      let newX: number, newZ: number
      let newY = 0
      let newYaw = activate.teleport?.direction || 0

      if (activate.teleport.altitude != null) {
        if (activate.teleport.type === 'absolute') {
          newY = activate.teleport.altitude * 10
        } else {
          newY = this.player.position.y + activate.teleport.altitude * 10
        }
      }
      if (activate.teleport.type === 'absolute') {
        newX = activate.teleport.ew * -10
        newZ = activate.teleport.ns * 10
      } else {
        newYaw += this.yaw
        newX = this.player.position.x + activate.teleport.x * -10
        newZ = this.player.position.z + activate.teleport.y * 10
      }
      this.teleportSvc.teleport.set({
        world: activate.teleport.worldName,
        // Don't send 0 if coordinates are null (world entry point)
        position: Utils.posToString(new Vector3(newX, newY, newZ), newYaw),
        isNew: true
      })
    }

    if (activate.url != null) {
      Object.assign(document.createElement('a'), {
        target: '_blank',
        rel: 'noopener noreferrer',
        href: activate.url.address
      }).click()
    }

    if (activate.move || activate.rotate) {
      item.userData.animation = {}
      if (activate?.move != null) {
        for (const move of activate.move) {
          if (move.targetName == null) {
            item.userData.animation.move = JSON.parse(JSON.stringify(move))
            // Reset on click
            item.position.copy(
              new Vector3()
                .add(item.userData.posOrig)
                .sub(item.parent.parent.position)
            )
          } else {
            getObjectsByUserData(
              this.objectsNode,
              'name',
              move.targetName
            ).forEach((prop: Group) => {
              prop.userData.animation = prop.userData.animation || {}
              prop.userData.animation.move = JSON.parse(JSON.stringify(move))
              prop.position.copy(
                new Vector3()
                  .add(prop.userData.posOrig)
                  .sub(prop.parent.parent.position)
              )
              this.handleSpecialObject(prop)
            })
          }
        }
      }
      if (activate?.rotate != null) {
        for (const rotate of activate.rotate) {
          if (rotate.targetName == null) {
            item.userData.animation.rotate = JSON.parse(JSON.stringify(rotate))
            // Reset on click
            item.rotation.copy(item.userData.rotOrig)
          } else {
            getObjectsByUserData(
              this.objectsNode,
              'name',
              rotate.targetName
            ).forEach((prop: Group) => {
              prop.userData.animation = prop.userData.animation || {}
              prop.userData.animation.rotate = JSON.parse(
                JSON.stringify(rotate)
              )
              prop.rotation.copy(prop.userData.rotOrig)
              this.handleSpecialObject(prop)
            })
          }
        }
      }
      this.handleSpecialObject(item)
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
      switch (prop.obj.userData.create.light?.fx) {
        case 'fire':
          fx = Math.random() * (1.2 - 0.8) + 0.8
          break
        case 'pulse': {
          const power = (Date.now() / 1000) % 1
          fx = Math.sin(power * Math.PI)
          break
        }
        case 'flash':
          fx = Math.random() > 0.02 ? 0 : 1
          break
        case 'flicker':
          fx = Math.random() > 0.02 ? 1 : 0
          break
        default:
          break
      }
      if (prop.obj.userData.create?.corona?.visible) {
        prop.obj.userData.create.corona.material.opacity = fx
      }
      light.position.set(prop.pos.x, prop.pos.y, prop.pos.z)
      light.color.set(prop.obj.userData.create.light.color)
      light.intensity =
        2.5 * fx * (prop.obj.userData.create.light.brightness || 0.5)
      light.distance = prop.obj.userData.create.light.radius || 10
    })
  }

  private moveCamera() {
    this.activeCamera.getWorldDirection(this.cameraDirection)
    let movSteps = 12 * this.deltaSinceLastFrame
    let rotSteps = 1.5 * this.deltaSinceLastFrame
    const reverse = this.activeCamera === this.thirdFrontCamera ? -1 : 1
    if (this.inputSysSvc.controls[PressedKey.run]) {
      movSteps = this.player.isFlying
        ? 72 * this.deltaSinceLastFrame
        : 24 * this.deltaSinceLastFrame
      rotSteps *= 3
    }
    if (this.inputSysSvc.controls[PressedKey.moveFwd]) {
      this.player.velocity.add(
        new Vector3(
          reverse * this.cameraDirection.x,
          0,
          reverse * this.cameraDirection.z
        ).multiplyScalar(movSteps)
      )
    }
    if (this.inputSysSvc.controls[PressedKey.moveBck]) {
      this.player.velocity.add(
        new Vector3(
          reverse * -this.cameraDirection.x,
          0,
          reverse * -this.cameraDirection.z
        ).multiplyScalar(movSteps)
      )
    }
    if (this.inputSysSvc.controls[PressedKey.turnLft]) {
      if (this.inputSysSvc.controls[PressedKey.clip]) {
        this.player.velocity.add(
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
        this.player.velocity.add(
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
      this.player.velocity.add(
        new Vector3(
          reverse * this.cameraDirection.z,
          0,
          reverse * -this.cameraDirection.x
        ).multiplyScalar(movSteps)
      )
    }
    if (this.inputSysSvc.controls[PressedKey.moveRgt]) {
      this.player.velocity.add(
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
      this.player.isFlying = true
      this.player.velocity.add(new Vector3(0, 1, 0).multiplyScalar(movSteps))
    }
    if (this.inputSysSvc.controls[PressedKey.moveDwn]) {
      this.player.isFlying = true
      this.player.velocity.add(new Vector3(0, 1, 0).multiplyScalar(-movSteps))
    }
    if (this.inputSysSvc.controls[PressedKey.jmp] && this.player.isOnFloor) {
      this.player.position.setY(this.player.position.y + Player.CLIMB_HEIGHT)
    }
    const damping = Math.exp(-3 * this.deltaSinceLastFrame) - 1
    if (this.player.isOnFloor) {
      this.player.velocity.addScaledVector(this.player.velocity, damping)
    } else if (
      !this.player.isFlying &&
      !this.inputSysSvc.controls[PressedKey.clip]
    ) {
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
      this.playerPosition.set(this.player.position.clone())
      this.rotateSprites()
      this.updateLODs()
    }
    this.player.inWater.set(
      this.water != null && this.water.position.y >= this.cameraPosition.y
    )
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
      this.propAnimSvc.rotateItem(item, this.deltaSinceLastFrame)
      item.updateMatrix()
    }
  }

  private async moveUsers() {
    for (const u of this.userSvc.userList()) {
      const user = this.usersNode.getObjectByName(u.id)
      if (user == null) {
        continue
      }
      u.completion = Math.min(1, u.completion + this.deltaSinceLastFrame / 0.2)
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
      const animation: Promise<AvatarAnimationPlayer> =
        user.userData.animationPlayer
      // Velocity is 0 if completion is done
      const velocity =
        u.completion < 1
          ? previousPos.distanceTo(user.position) / this.deltaSinceLastFrame
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
    for (const item of this.sprites) {
      item.rotation.set(0, this.player.rotation.y, 0)
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
