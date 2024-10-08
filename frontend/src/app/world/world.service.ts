import {inject, Injectable, effect, signal} from '@angular/core'
import type {WritableSignal} from '@angular/core'
import {EMPTY, Subject, throwError, from, of, firstValueFrom} from 'rxjs'
import type {Observable, Subscription} from 'rxjs'
import {
  mergeMap,
  concatMap,
  bufferCount,
  catchError,
  debounceTime
} from 'rxjs/operators'
import {
  Euler,
  Mesh,
  Group,
  Vector3,
  LOD,
  BufferGeometry,
  MeshBasicMaterial,
  Box3,
  BufferAttribute
} from 'three'
import type {Object3D} from 'three'
import {SRGBToLinear} from 'three/src/math/ColorManagement.js'
import {UserService} from '../user'
import type {User} from '../user'
import {SettingsService} from '../settings/settings.service'
import {EngineService} from '../engine/engine.service'
import {TerrainService} from './terrain.service'
import {TeleportService} from '../engine/teleport.service'
import {PlayerCollider} from '../engine/player-collider'
import type {PropCtl} from './prop.service'
import {PropService} from './prop.service'
import {PropActionService} from './prop-action.service'
import {SocketService} from '../network/socket.service'
import {AvatarAnimationService} from '../animation'
import type {AvatarAnimationManager} from '../animation'
import {HttpService} from '../network'
import {environment} from '../../environments/environment'
import {DEG, Utils} from '../utils'
import {BuildService} from '../engine/build.service'
import {LightingService} from './lighting.service'

@Injectable({providedIn: 'root'})
export class WorldService {
  avatarList: {
    name: string
    geometry: string
    implicit: Map<string, string>
    explicit: Map<string, string>
  }[] = []
  avatarSub = new Subject<number>()
  gestures = signal<Map<string, string>>(new Map())
  worldId = 0
  worldList = []
  skybox = signal('')
  skyTop: WritableSignal<string>
  skyNorth: WritableSignal<string>
  skyEast: WritableSignal<string>
  skySouth: WritableSignal<string>
  skyWest: WritableSignal<string>
  skyBottom: WritableSignal<string>

  private readonly engineSvc = inject(EngineService)
  private readonly lightingSvc = inject(LightingService)
  private readonly terrainSvc = inject(TerrainService)
  private readonly userSvc = inject(UserService)
  private readonly propSvc = inject(PropService)
  private readonly propActionSvc = inject(PropActionService)
  private readonly anmSvc = inject(AvatarAnimationService)
  private readonly http = inject(HttpService)
  private readonly settings = inject(SettingsService)
  private readonly socket = inject(SocketService)
  private readonly teleportSvc = inject(TeleportService)
  private readonly buildSvc = inject(BuildService)

  private worldName = 'Nowhere'
  private lastChunk = null

  private chunkWidth: number = environment.world.chunk.width // in cm
  private chunkDepth: number = environment.world.chunk.depth // in cm
  private chunkMap = new Map<number, Set<number>>()
  private chunkLoadingLayout = []
  private chunkLoadCircular: boolean = environment.world.chunk.loadCircular
  private chunkLoadRadius: number = environment.world.chunk.loadRadius

  private maxLodDistance: number = environment.world.lod.maxDistance

  private uAvatarListener: Subscription
  private avatarListener: Subscription

  constructor() {
    this.skyTop = signal(Utils.colorHexToStr(0))
    this.skyNorth = signal(Utils.colorHexToStr(0))
    this.skyEast = signal(Utils.colorHexToStr(0))
    this.skySouth = signal(Utils.colorHexToStr(0))
    this.skyWest = signal(Utils.colorHexToStr(0))
    this.skyBottom = signal(Utils.colorHexToStr(0))
    // Effect for teleport
    effect(() => {
      const {world, position, isNew} = this.teleportSvc.teleport()

      // No world joined yet
      if (world?.toLowerCase() === 'nowhere') {
        return
      }
      // Connect to the socket first
      this.socket.connect()

      const currentPos = this.playerLocation.position

      if (!world || world.toLowerCase() === this.worldName.toLowerCase()) {
        this.teleportSvc.teleportFrom(this.worldName, currentPos, isNew)
        this.teleport(position)
        return
      }

      const targetWorld = this.worldList.find(
        (w) => w.name.toLowerCase() === world.toLowerCase()
      )
      if (!targetWorld) {
        this.socket.messages.next({
          type: 'err',
          data: `World ${world} is not available`
        })
        return
      }

      this.http.world(targetWorld.id).subscribe((w: any) => {
        this.teleportSvc.teleportFrom(this.worldName, currentPos, isNew)
        this.setWorld(w, position)
      })
    })

    // Effect for skybox
    effect(() => {
      this.createSkybox(this.skybox(), {
        top: Utils.hexToRgb(Utils.colorStrToHex(this.skyTop())),
        north: Utils.hexToRgb(Utils.colorStrToHex(this.skyNorth())),
        east: Utils.hexToRgb(Utils.colorStrToHex(this.skyEast())),
        south: Utils.hexToRgb(Utils.colorStrToHex(this.skySouth())),
        west: Utils.hexToRgb(Utils.colorStrToHex(this.skyWest())),
        bottom: Utils.hexToRgb(Utils.colorStrToHex(this.skyBottom()))
      })
    })

    // Register texture animator to the engine
    effect(() => {
      if (this.engineSvc.texturesAnimation() > 0) {
        this.propSvc.texturesNextFrame()
      }
    })

    for (let i = -this.chunkLoadRadius; i <= this.chunkLoadRadius; i++) {
      for (let j = -this.chunkLoadRadius; j <= this.chunkLoadRadius; j++) {
        // Only keep chunks within a certain circular radius (if circular loadin is enabled)
        if (
          !this.chunkLoadCircular ||
          i * i + j * j < this.chunkLoadRadius * this.chunkLoadRadius
        ) {
          this.chunkLoadingLayout.push([i, j])
        }
      }
    }

    // For extra comfort: we can sort each chunk in the layout based on there distance to the center,
    // this ought to make the client load and display nearest chunks first
    this.chunkLoadingLayout.sort(([x0, z0], [x1, z1]) => {
      const d0 = x0 * x0 + z0 * z0
      const d1 = x1 * x1 + z1 * z1
      return d0 - d1
    })

    // Position update
    effect(() => {
      // Register chunk updater to the engine
      this.autoUpdateChunks(this.engineSvc.playerPosition())
      this.terrainSvc.getTerrainPages(
        this.engineSvc.playerPosition().x,
        this.engineSvc.playerPosition().z,
        1
      )
    })

    // User list change
    effect(() => {
      for (const user of this.engineSvc.users()) {
        if (
          this.userSvc
            .userList()
            .filter((u) => u.world === this.worldId)
            .map((u) => u.id)
            .indexOf(user.name) === -1
        ) {
          this.engineSvc.removeUser(user)
        }
      }
      for (const u of this.userSvc.userList()) {
        const user = this.engineSvc.users().find((o) => o.name === u.id)
        if (
          user == null &&
          this.avatarList.length > 0 &&
          u.world === this.worldId
        ) {
          this.addUser(u)
        }
      }
    })

    // Register object chunk updater to the engine
    this.propSvc.propControl.subscribe((action: PropCtl) => {
      if (
        [
          'up',
          'down',
          'forward',
          'backward',
          'left',
          'right',
          'snapGrid',
          'copy'
        ].includes(action)
      ) {
        this.setObjectChunk(this.buildSvc.selectedProp)
      }
    })
  }

  initWorld() {
    this.destroyWorld()

    // listeners
    // other avatars
    this.uAvatarListener = this.userSvc.avatarChanged.subscribe((u) => {
      const user = this.engineSvc.users().find((o) => o.name === u.id)
      const avatarId = u.avatar >= this.avatarList.length ? 0 : u.avatar
      const avatarEntry = this.avatarList[avatarId]
      const animationManager: Promise<AvatarAnimationManager> =
        this.anmSvc.getAvatarAnimationManager(
          avatarEntry.name,
          avatarEntry.implicit,
          avatarEntry.explicit
        )
      this.setAvatar(avatarEntry.geometry, animationManager, user)
    })

    // own avatar
    this.avatarListener = this.avatarSub.subscribe((avatarId: number) => {
      this.gestures.set(this.avatarList[avatarId].explicit)
      const avatarEntry = this.avatarList[avatarId]
      const animationManager: Promise<AvatarAnimationManager> =
        this.anmSvc.getAvatarAnimationManager(
          avatarEntry.name,
          avatarEntry.implicit,
          avatarEntry.explicit
        )
      this.setAvatar(
        avatarEntry.geometry,
        animationManager,
        this.engineSvc.avatar
      )
      const savedAvatars = this.settings.get('avatar')
      const avatarMap =
        savedAvatars != null
          ? new Map<number, number>(savedAvatars)
          : new Map<number, number>()
      avatarMap.set(this.worldId, avatarId)
      this.settings.set('avatar', Array.from(avatarMap.entries()))
    })
  }

  destroyWorld() {
    this.resetChunks()
    this.engineSvc.resetChunkLODMap()
    this.uAvatarListener?.unsubscribe()
    this.avatarListener?.unsubscribe()
  }

  set visibility(visibility: number) {
    this.maxLodDistance = visibility
    this.engineSvc.setChunksDistance(visibility)
  }

  get playerLocation() {
    return {
      world: this.worldName,
      position: Utils.posToString(
        this.engineSvc.position[0],
        this.engineSvc.yaw
      )
    }
  }

  private createSkybox(
    skybox: string,
    skyColors: {
      top: number[]
      north: number[]
      east: number[]
      south: number[]
      west: number[]
      bottom: number[]
    } = {
      top: [0, 0, 0],
      north: [0, 0, 0],
      east: [0, 0, 0],
      south: [0, 0, 0],
      west: [0, 0, 0],
      bottom: [0, 0, 0]
    }
  ) {
    const skyboxGroup = new Group()
    skyboxGroup.renderOrder = -1
    const octGeom = new BufferGeometry()

    // 6 vertices to make an octahedron
    // prettier-ignore
    const positions = [
       0,  0,  1, // north vertex (0)
      -1,  0,  0, // east vertex (1)
       0,  0, -1, // south vertex (2)
       1,  0,  0, // west vertex (3)
       0,  1,  0, // top vertex (4)
       0, -1,  0  // bottom vertex (5)
    ]

    const colors = ['north', 'east', 'south', 'west', 'top', 'bottom']
      .flatMap((attr) => skyColors[attr])
      .map((c: number) => SRGBToLinear(c / 255))

    octGeom.setAttribute(
      'position',
      new BufferAttribute(new Float32Array(positions), 3)
    )
    octGeom.setAttribute(
      'color',
      new BufferAttribute(new Float32Array(colors), 3)
    )

    // 8 triangle faces to make an octahedron
    // prettier-ignore
    octGeom.setIndex([
      4, 0, 1, // top north east face
      4, 1, 2, // top south east face
      4, 2, 3, // top south west face
      4, 3, 0, // top north west face
      5, 1, 0, // bottom north east face
      5, 2, 1, // bottom south east face
      5, 3, 2, // bottom south west face
      5, 0, 3  // bottom north west face
    ])

    octGeom.addGroup(0, octGeom.getIndex().count, 0)

    const oct = new Mesh(octGeom, [
      new MeshBasicMaterial({vertexColors: true, depthWrite: false})
    ])
    skyboxGroup.add(oct)

    if (skybox) {
      this.propSvc.loadModel(skybox, true).subscribe((s) => {
        const skyboxRwx = s.clone()
        const box = new Box3().setFromObject(skyboxRwx)
        const center = box.getCenter(new Vector3())
        skyboxRwx.position.set(0, -center.y, 0)
        skyboxGroup.add(skyboxRwx)
      })
    }
    this.engineSvc.setSkybox(skyboxGroup)
  }

  private resetChunks() {
    this.lastChunk = null
    this.chunkMap.clear()
  }

  private async loadProp(
    id: number,
    prop: string,
    pos: Vector3,
    rot: Vector3,
    date = 0,
    desc = null,
    act = null
  ): Promise<Object3D> {
    prop = Utils.modelName(prop)
    const g = await firstValueFrom(this.propSvc.loadModel(prop))
    g.name = prop
    g.userData.id = id
    g.userData.date = date
    g.userData.desc = desc
    g.userData.act = act
    const box = new Box3().setFromObject(g)
    const center = box.getCenter(new Vector3())
    g.userData.box = {
      x: box.max.x - box.min.x,
      y: box.max.y - box.min.y,
      z: box.max.z - box.min.z
    }
    g.userData.boxCenter = {x: center.x, y: center.y, z: center.z}
    g.position.set(pos.x / 100, pos.y / 100, pos.z / 100)
    g.rotation.set(
      (rot.x * DEG) / 10,
      (rot.y * DEG) / 10,
      (rot.z * DEG) / 10,
      'YZX'
    )
    g.userData.posOrig = g.position.clone()
    g.userData.rotOrig = g.rotation.clone()
    if (act && g.userData?.isError !== true) {
      this.propActionSvc.parseActions(g)
    }
    g.userData.onShow = (shown: () => void) => {
      this.propActionSvc.showProp(g)
      shown()
    }
    g.userData.onHide = (hidden: () => void) => {
      this.propActionSvc.hideProp(g)
      hidden()
    }
    g.userData.onClick = (clicked: () => void) => {
      this.propActionSvc.clickProp(g)
      clicked()
    }
    g.userData.onUpdate = () => {}

    g.updateMatrix()
    return g
  }

  private async setAvatar(
    name: string,
    animationMgr: Promise<AvatarAnimationManager>,
    group: Group
  ) {
    if (group == null) {
      // User not within this world
      return
    }
    name = Utils.modelName(name)
    this.propSvc.loadAvatar(name).subscribe(async (o) => {
      o.rotation.copy(new Euler(0, Math.PI, 0))
      group.parent.updateMatrixWorld()
      group.position.setY(group.parent.position.y)
      this.engineSvc.disposeMaterial(group)
      this.engineSvc.disposeGeometry(group)
      group.clear().add(o.clone())
      const box = new Box3().setFromObject(group)
      group.userData.height = box.max.y - box.min.y
      group.userData.offsetY = group.position.y - box.min.y
      group.userData.animationPlayer = (
        await animationMgr
      ).spawnAnimationPlayer(group)
      if (group.name === 'avatar') {
        this.engineSvc.setCameraOffset(group.userData.height * 0.9)
        this.engineSvc.updateBoundingBox()
        group.position.setY(group.position.y + group.userData.offsetY)
      } else {
        const user = this.userSvc.getUser(group.name)
        group.position.setY(user.y + group.userData.offsetY)
      }
    })
  }

  // Get chunk tile X and Z ids from position
  private getChunkTile(pos: Vector3): [number, number] {
    const tileX = Math.floor(
      (Math.floor(pos.x * 100) + this.chunkWidth / 2) / this.chunkWidth
    )
    const tileZ = Math.floor(
      (Math.floor(pos.z * 100) + this.chunkDepth / 2) / this.chunkDepth
    )

    return [tileX, tileZ]
  }

  // Get chunk position from tile X and Z ids
  private getChunkCenter(tileX: number, tileZ: number) {
    const xPos = (tileX * this.chunkWidth) / 100
    const zPos = (tileZ * this.chunkDepth) / 100

    return new Vector3(xPos, 0, zPos)
  }

  // this method is to be called on each position change to update the state of chunks if needed
  private autoUpdateChunks(pos: Vector3) {
    const [chunkX, chunkZ] = this.getChunkTile(pos)
    this.engineSvc.currentChunk = [chunkX, chunkZ]

    // Do nothing if the current chunk didn't change or if we're nowhere
    if (
      (this.lastChunk != null &&
        this.lastChunk[0] === chunkX &&
        this.lastChunk[1] === chunkZ) ||
      this.worldId === 0
    ) {
      return
    }

    this.lastChunk = [chunkX, chunkZ]

    // For clarity: we get an Observable from loadChunk, if it produces anything: we take care of it
    // in subscribe() (note that if the chunk has already been loaded, it won't reach the operator).
    // We also tag the chunk as not being loaded if any error were to happen (like a failed http request)
    from(this.chunkLoadingLayout)
      .pipe(
        concatMap((val) => this.loadChunk(chunkX + val[0], chunkZ + val[1]))
      )
      .subscribe({
        next: (chunk: LOD) => {
          this.engineSvc.addChunk(chunk)
        },
        error: (val: any) => {
          console.error(val.err)
          if (this.chunkMap.get(val.x)?.has(val.z)) {
            this.chunkMap.get(val.x).delete(val.z)
          }
        }
      })
  }

  private loadChunk(x: number, z: number): Observable<LOD> {
    // If the chunk was already loaded: we skip it
    if (this.chunkMap.get(x)?.has(z)) {
      return EMPTY
    }

    // tag this chunk as being worked on already
    if (!this.chunkMap.has(x)) {
      this.chunkMap.set(x, new Set<number>())
    }
    this.chunkMap.get(x).add(z)

    const chunkPos = this.getChunkCenter(x, z)

    // We first need to fetch the list of props using HttpService, we cannot go further
    // with this chunk if this call fails
    return this.http
      .props(
        this.worldId,
        x * this.chunkWidth - this.chunkWidth / 2,
        x * this.chunkWidth + this.chunkWidth / 2,
        null,
        null,
        z * this.chunkDepth - this.chunkDepth / 2,
        z * this.chunkDepth + this.chunkDepth / 2
      )
      .pipe(
        concatMap((props: any) =>
          from(props.entries).pipe(
            mergeMap((prop: any) =>
              this.loadProp(
                prop[0],
                prop[2],
                new Vector3(prop[3], prop[4], prop[5]),
                new Vector3(prop[6], prop[7], prop[8]),
                prop[1],
                prop[9],
                prop[10]
              )
            ),
            mergeMap((prop: Object3D) => {
              const chunkOffset = new Vector3(chunkPos.x, 0, chunkPos.z)
              prop.position.sub(chunkOffset)
              prop.updateMatrix()
              return of(prop)
            }), // Adjust position of objects based on the center of the chunk
            bufferCount(props.entries.length), // Wait for all props to be loaded before proceeding
            mergeMap((objs: Object3D[]) => {
              const chunkGroup = new Group().add(...objs)
              // Set metadata on the chunk
              const lod = new LOD()
              lod.userData.rwx = {axisAlignment: 'none'}
              lod.userData.world = {chunk: {x, z}}

              chunkGroup.userData.rwx = {axisAlignment: 'none'}
              chunkGroup.userData.world = {
                chunk: {x: chunkPos.x, z: chunkPos.z}
              }
              const bvhUpdate = new Subject()
              bvhUpdate.pipe(debounceTime(200)).subscribe(() => {
                PlayerCollider.updateChunkBVH(chunkGroup)
              })
              chunkGroup.userData.bvhUpdate = bvhUpdate

              lod.addLevel(chunkGroup, this.maxLodDistance)
              lod.addLevel(new Group(), this.maxLodDistance + 1)
              lod.position.set(chunkPos.x, 0, chunkPos.z)
              lod.autoUpdate = false
              lod.updateMatrix()
              chunkGroup.parent.visible = false
              chunkGroup.userData.bvhUpdate.next()

              return of(lod)
            })
          )
        ),
        catchError((err) => throwError(() => ({x, z, err})))
      )
  }

  private setObjectChunk(object: Object3D) {
    const oldChunk = object.parent as Group
    const oldLOD = oldChunk.parent
    const oldChunkPos = oldLOD.position
    const absPos = object.position.clone().add(oldChunkPos)
    const [chunkX, chunkZ] = this.getChunkTile(absPos)

    const newLOD = this.engineSvc.getLODs().find((lod) => {
      return (
        lod.userData.world.chunk.x === chunkX &&
        lod.userData.world.chunk.z === chunkZ
      )
    })

    if (newLOD) {
      oldChunk.remove(object)

      // Regenerate boundsTree for source LOD, if it's different from the destination one
      if (oldLOD !== newLOD) {
        oldChunk.userData.bvhUpdate.next()
      }

      const chunk = newLOD.levels[0].object
      chunk.add(object)
      object.position.add(oldChunkPos).sub(newLOD.position)
      return
    }
    console.log(
      `Warning: Trying to move object ${object.name} to an uninitialized chunk (${chunkX}, ${chunkZ})`
    )
  }

  /**
   * Teleport within this world
   *
   * @param entry Teleport string
   */
  private teleport(entry: string | null) {
    const entryPoint = new Vector3()
    let entryYaw = 0
    if (entry) {
      const yawMatch = /\s([-+]?\d+)$/.exec(entry)
      entryYaw = yawMatch ? parseInt(yawMatch[1], 10) : entryYaw
      entryPoint.copy(Utils.stringToPos(entry))
    }

    // Load a few chunks on world initialization
    this.autoUpdateChunks(entryPoint)
    this.engineSvc.setPlayerPos(entryPoint, entryYaw)
    this.engineSvc.updateBoundingBox()
  }

  /**
   * Teleport to another world
   *
   * @param world World object from API
   * @param entry Teleport string
   * @returns Nothing
   */
  private setWorld(world: any, entry: string | null) {
    if (!entry && world.entry) {
      entry = world.entry
    }

    if (this.worldId === world.id) {
      this.teleport(entry)
      return
    }

    this.socket.messages.next({type: 'info', data: world.welcome ?? ''})

    this.worldId = world.id
    this.worldName = world.name
    this.engineSvc.clearObjects()
    this.propSvc.cleanCache()
    this.anmSvc.cleanCache()
    this.propSvc.path.set(world.path)
    this.terrainSvc.setTerrain(world?.terrain, world.id)
    this.terrainSvc.setWater(world?.water)
    this.skybox.set(world.sky.skybox)
    this.skyTop.set(
      Utils.colorHexToStr(
        Utils.rgbToHex(...(world.sky.top_color as [number, number, number]))
      )
    )
    this.skyNorth.set(
      Utils.colorHexToStr(
        Utils.rgbToHex(...(world.sky.north_color as [number, number, number]))
      )
    )
    this.skyEast.set(
      Utils.colorHexToStr(
        Utils.rgbToHex(...(world.sky.east_color as [number, number, number]))
      )
    )
    this.skySouth.set(
      Utils.colorHexToStr(
        Utils.rgbToHex(...(world.sky.south_color as [number, number, number]))
      )
    )
    this.skyWest.set(
      Utils.colorHexToStr(
        Utils.rgbToHex(...(world.sky.west_color as [number, number, number]))
      )
    )
    this.skyBottom.set(
      Utils.colorHexToStr(
        Utils.rgbToHex(...(world.sky.bottom_color as [number, number, number]))
      )
    )
    this.lightingSvc.ambLightColor = Utils.rgbToHex(
      ...(world.light.amb_color as [number, number, number])
    )
    this.lightingSvc.dirLightColor = Utils.rgbToHex(
      ...(world.light.dir_color as [number, number, number])
    )
    this.lightingSvc.dirLightTarget = [
      world.light.dir.x * 100,
      world.light.dir.y * 100,
      world.light.dir.z * 100
    ]
    this.lightingSvc.worldFog = {
      color: Utils.rgbToHex(
        ...(world.light.fog.color as [number, number, number])
      ),
      near: world.light.fog.min,
      far: world.light.fog.max,
      enabled: world.light.fog.enabled
    }

    this.http.avatars(this.propSvc.path()).subscribe((list) => {
      this.avatarList = list
      // Set first avatar on self
      const savedAvatars = this.settings.get('avatar')
      const avatarMap =
        savedAvatars != null
          ? new Map<number, number>(savedAvatars)
          : new Map<number, number>()
      this.avatarSub.next(avatarMap.get(this.worldId) || 0)
      // Trigger list update to create users
      this.userSvc.userList.set([...this.userSvc.userList()])
    })

    this.resetChunks()
    this.teleport(entry)
  }

  private addUser(user: User) {
    if (user.name !== this.userSvc.currentName) {
      const group = new Group()
      group.name = user.id
      group.position.set(user.x, user.y, user.z)
      group.rotation.set(user.roll, user.yaw, user.pitch)
      group.userData.player = true
      const avatarEntry = this.avatarList[user.avatar]
      this.setAvatar(
        this.avatarList[user.avatar].geometry,
        this.anmSvc.getAvatarAnimationManager(
          avatarEntry.name,
          avatarEntry.implicit,
          avatarEntry.explicit
        ),
        group
      )
      this.engineSvc.addUser(group)
    }
  }
}
