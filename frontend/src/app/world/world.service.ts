import type {Observable, Subscription} from 'rxjs'
import type {Object3D, Vector3Like} from 'three'
import {HttpClient} from '@angular/common/http'
import {inject, Service, signal} from '@angular/core'
import {toObservable} from '@angular/core/rxjs-interop'
import {
  catchError,
  debounceTime,
  EMPTY,
  finalize,
  firstValueFrom,
  from,
  map,
  mergeMap,
  Subject,
  take,
  throwError,
  toArray
} from 'rxjs'
import {Box3, Cache, Group, LOD} from 'three'
import type {AvatarAnimationManager} from '../animation'
import type {User} from '../user'
import type {LightData} from './lighting.service'
import type {PropCtl, PropEntry} from './prop.service'
import type {SkyData} from './sky.service'
import type {TerrainData, WaterData} from './terrain.service'
import {environment} from '../../environments/environment'
import {AvatarAnimationService} from '../animation'
import {AuthService} from '../auth/auth.service'
import {BuildService} from '../engine/build.service'
import {EngineService} from '../engine/engine.service'
import {PlayerCollider} from '../engine/player-collider'
import {TeleportService} from '../engine/teleport.service'
import {SocketService} from '../network'
import {SettingsService} from '../settings/settings.service'
import {UserService} from '../user'
import {DEG, EYE_LEVEL} from '../utils/constants'
import {
  disposeGroupGeometries,
  disposeGroupMaterials,
  modelName,
  posToStringYaw,
  stringToPos
} from '../utils/utils'
import {WorkerService} from '../worker/worker.service'
import {LightingService} from './lighting.service'
import {PropActionService} from './prop-action.service'
import {PropService} from './prop.service'
import {SkyService} from './sky.service'
import {TerrainService} from './terrain.service'

export interface Avatar {
  name: string
  geometry: string
  implicit: Map<string, string>
  explicit: Map<string, string>
}

interface WorldData {
  id: number
  name: string
  sky: SkyData
  path: string
  welcome?: string
  terrain?: TerrainData
  entry?: string
  gravity?: number
  water?: WaterData
  light: LightData
}

@Service()
export class WorldService {
  avatarList: Avatar[] = []
  ownAvatar = signal<number | null>(null)
  gestures = signal<Map<string, string>>(new Map())
  worldId = signal(0)
  worldList = signal<{id: number; name: string; users: number}[]>([])

  private readonly http = inject(HttpClient)
  private readonly engineSvc = inject(EngineService)
  private readonly skySvc = inject(SkyService)
  private readonly lightingSvc = inject(LightingService)
  private readonly terrainSvc = inject(TerrainService)
  private readonly userSvc = inject(UserService)
  private readonly propSvc = inject(PropService)
  private readonly propActionSvc = inject(PropActionService)
  private readonly anmSvc = inject(AvatarAnimationService)
  private readonly authSvc = inject(AuthService)
  private readonly settings = inject(SettingsService)
  private readonly socket = inject(SocketService)
  private readonly teleportSvc = inject(TeleportService)
  private readonly buildSvc = inject(BuildService)
  private readonly workerSvc = inject(WorkerService)

  private readonly maxActiveChunks = 3
  private chunkSubs = new Set<Subscription>()
  private pendingChunks: [number, number][] = []
  private lastDir = {x: 0, z: -1}
  private yieldPromise: Promise<void> | null = null
  private lastYieldTime = 0
  private worldName = 'Nowhere'
  private lastChunk: number[] = []

  private chunkWidth: number = environment.world.chunk.width // in cm
  private chunkDepth: number = environment.world.chunk.depth // in cm
  private chunkMap = new Map<number, Set<number>>()
  private chunkLoadingLayout: [number, number][] = []
  private chunkLoadCircular: boolean = environment.world.chunk.loadCircular
  private chunkLoadRadius: number = environment.world.chunk.loadRadius

  private maxLodDistance: number = environment.world.lod.maxDistance

  private uAvatarListener: Subscription

  constructor() {
    toObservable(this.teleportSvc.teleport).subscribe(
      ({world, position, isNew}) => {
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

        const targetWorld = this.worldList().find(
          (w) => w.name.toLowerCase() === world.toLowerCase()
        )
        if (!targetWorld) {
          this.socket.messages.next({
            type: 'err',
            data: `World ${world} is not available`
          })
          return
        }

        this.cancelChunkLoading()
        this.getWorld(targetWorld.id).subscribe((w: WorldData) => {
          this.teleportSvc.teleportFrom(this.worldName, currentPos, isNew)
          this.setWorld(w, position)
        })
      }
    )

    // Register texture animator to the engine
    toObservable(this.engineSvc.texturesAnimation).subscribe((animation) => {
      if (animation > 0) this.propSvc.texturesNextFrame()
    })

    for (let i = -this.chunkLoadRadius; i <= this.chunkLoadRadius; i++) {
      for (let j = -this.chunkLoadRadius; j <= this.chunkLoadRadius; j++) {
        // Only keep chunks within a certain circular radius (if circular loading is enabled)
        if (
          !this.chunkLoadCircular ||
          i * i + j * j < this.chunkLoadRadius * this.chunkLoadRadius
        ) {
          this.chunkLoadingLayout.push([i, j])
        }
      }
    }

    // Register chunk updater to the engine
    toObservable(this.engineSvc.playerPosition).subscribe((position) => {
      this.autoUpdateChunks(position)
      this.terrainSvc.getTerrainPages(position.x, position.z, 1, this.worldId())
    })

    // User list change
    toObservable(this.userSvc.userList).subscribe((userList) => {
      for (const user of this.engineSvc.users()) {
        if (
          !userList
            .filter((u) => u.world === this.worldId())
            .map((u) => u.id)
            .includes(user.name)
        ) {
          this.engineSvc.removeUser(user)
        }
      }
      for (const u of userList) {
        const user = this.engineSvc.users().find((o) => o.name === u.id)
        if (
          user != null ||
          this.avatarList.length == 0 ||
          u.world !== this.worldId()
        ) {
          continue
        }
        this.addUser(u)
      }
    })

    // own avatar
    toObservable(this.ownAvatar).subscribe((avatarId: number | null) => {
      if (avatarId == null || this.avatarList.length === 0) return
      const avatarEntry = this.avatarList[avatarId] ?? this.avatarList[0]
      this.gestures.set(avatarEntry.explicit)
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
      const avatarMap = new Map<number, number>(
        this.settings.get('avatar') || []
      )
      avatarMap.set(this.worldId(), avatarId)
      this.settings.set('avatar', Array.from(avatarMap.entries()))
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
        this.setObjectChunk(this.buildSvc.selectedProp())
      }
    })
  }

  getAvatars(path: string) {
    const list: Avatar[] = []
    let [readImp, readExp] = [false, false]
    return this.http
      .get(`${path}/avatars/avatars.dat`, {responseType: 'text'})
      .pipe(
        map((fileContent: string) => {
          fileContent.split('\n').forEach((line: string) => {
            line = line.trim()
            const i = list.length - 1
            if (line === 'avatar') {
              list.push({
                name: '',
                geometry: '',
                implicit: new Map<string, string>(),
                explicit: new Map<string, string>()
              })
              return
            }
            if (line.startsWith('name=')) {
              list[i].name = line.substring(5)
            } else if (line.startsWith('geometry=')) {
              list[i].geometry = line.substring(9)
            } else if (line.startsWith('beginimp')) {
              readImp = true
            } else if (line.startsWith('endimp')) {
              readImp = false
            } else if (line.startsWith('beginexp')) {
              readExp = true
            } else if (line.startsWith('endexp')) {
              readExp = false
            } else {
              const values = line.split('=')
              if ((!readImp && !readExp) || values.length !== 2) {
                return
              }
              list[i][readImp ? 'implicit' : 'explicit'].set(
                values[0],
                values[1]
              )
            }
          })
          return list
        })
      )
  }

  getWorld(worldId: number) {
    return this.http.get(`${environment.url.server}/world/${worldId}`)
  }

  getWorlds() {
    return this.http.get(`${environment.url.server}/world/`)
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
  }

  destroyWorld() {
    this.cancelChunkLoading()
    this.resetChunks()
    this.engineSvc.resetChunkLODMap()
    this.uAvatarListener?.unsubscribe()
  }

  set visibility(visibility: number) {
    this.maxLodDistance = visibility
    this.engineSvc.setChunksDistance(visibility)
  }

  get playerLocation() {
    return {
      world: this.worldName,
      position: posToStringYaw(this.engineSvc.position[0], this.engineSvc.yaw)
    }
  }

  private resetChunks() {
    this.lastChunk = []
    this.chunkMap.clear()
  }

  private yieldToMain(): Promise<void> {
    if (this.yieldPromise != null) {
      return this.yieldPromise
    }
    if (performance.now() - this.lastYieldTime < 8) {
      return Promise.resolve()
    }
    this.yieldPromise = new Promise((resolve) =>
      setTimeout(() => {
        this.lastYieldTime = performance.now()
        this.yieldPromise = null
        resolve()
      }, 0)
    )
    return this.yieldPromise
  }

  private async loadProp(
    id: number,
    prop: string,
    pos: Vector3Like,
    rot: Vector3Like,
    date = 0,
    desc: string | null = null,
    act: string | null = null
  ): Promise<Object3D> {
    prop = modelName(prop)
    const g = await firstValueFrom(this.propSvc.loadModel(prop))
    await this.yieldToMain()
    g.name = prop
    g.userData.id = id
    g.userData.date = date
    g.userData.desc = desc
    g.userData.act = act
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
      await this.propActionSvc.parseActions(g)
    }
    this.buildSvc.initPropCallbacks(g)
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
    name = modelName(name)
    this.propSvc.loadAvatar(name).subscribe(async (o) => {
      o.rotation.set(0, Math.PI, 0)
      o.updateMatrixWorld(true)

      const box = new Box3().setFromObject(o)
      const height = box.max.y - box.min.y
      // Anchor feet at y = 0 and center horizontally on group origin
      o.position.set(
        -(box.min.x + box.max.x) / 2,
        -box.min.y,
        -(box.min.z + box.max.z) / 2
      )
      o.updateMatrixWorld(true)

      let eyeHeight = height * EYE_LEVEL
      let headGroup: Object3D | null = null
      o.traverse((child) => {
        if (Number(child.userData?.rwx?.tag) === 4) {
          headGroup = child
        }
      })
      if (headGroup != null) {
        const headBox = new Box3().setFromObject(headGroup)
        if (!headBox.isEmpty() && headBox.max.y > 0) {
          eyeHeight = (headBox.min.y + headBox.max.y) / 2
        }
      }

      disposeGroupMaterials(group)
      disposeGroupGeometries(group)
      group.clear().add(o)
      group.userData.height = height
      group.userData.animationPlayer = (
        await animationMgr
      ).spawnAnimationPlayer(group)
      if (group.name === 'avatar') {
        group.position.set(0, 0, 0)
        this.engineSvc.setCameraOffset(eyeHeight)
        this.engineSvc.updateBoundingBox(height)
      }
    })
  }

  // Get chunk tile X and Z ids from position
  private getChunkTile(pos: Vector3Like): [number, number] {
    const tileX = Math.floor(
      (Math.floor(pos.x * 100) + this.chunkWidth / 2) / this.chunkWidth
    )
    const tileZ = Math.floor(
      (Math.floor(pos.z * 100) + this.chunkDepth / 2) / this.chunkDepth
    )

    return [tileX, tileZ]
  }

  private cancelChunkLoading() {
    this.pendingChunks.length = 0
    for (const sub of [...this.chunkSubs]) {
      sub.unsubscribe()
    }
    this.chunkSubs.clear()
  }

  // this method is to be called on each position change to update the state of chunks if needed
  private autoUpdateChunks(pos: Vector3Like) {
    if (this.worldId() === 0) {
      // Nowhere
      return
    }
    const [chunkX, chunkZ] = this.getChunkTile(pos)
    this.engineSvc.currentChunk = [chunkX, chunkZ]
    const dir = this.engineSvc.viewDirection

    const sameChunk =
      this.lastChunk.length > 0 &&
      this.lastChunk[0] === chunkX &&
      this.lastChunk[1] === chunkZ
    const turned = dir.x * this.lastDir.x + dir.z * this.lastDir.z < 0.7

    // Do nothing if the chunk didn't change and we didn't turn while chunks remain pending
    if (sameChunk && (!turned || this.pendingChunks.length === 0)) {
      return
    }

    this.lastChunk = [chunkX, chunkZ]
    this.lastDir = dir

    // Prioritize chunk under feet, then chunks directly in front of the view direction
    this.pendingChunks = this.chunkLoadingLayout
      .map(([dx, dz]): [number, number, number] => {
        const dist = Math.hypot(dx, dz)
        const dot = dist === 0 ? 1 : (dx * dir.x + dz * dir.z) / dist
        return [chunkX + dx, chunkZ + dz, dist * (2 - dot)]
      })
      .filter(([x, z]) => !this.chunkMap.get(x)?.has(z))
      .sort((a, b) => a[2] - b[2])
      .map(([x, z]) => [x, z])

    this.pumpChunks()
  }

  private pumpChunks() {
    while (
      this.chunkSubs.size < this.maxActiveChunks &&
      this.pendingChunks.length > 0
    ) {
      const [x, z] = this.pendingChunks.shift()!
      if (this.chunkMap.get(x)?.has(z)) {
        continue
      }
      const sub = this.loadChunk(x, z).subscribe({
        next: (chunk: LOD) => {
          this.engineSvc.addChunk(chunk)
        },
        error: (val) => {
          console.error(val.err)
        }
      })
      if (!sub.closed) {
        this.chunkSubs.add(sub)
        sub.add(() => {
          this.chunkSubs.delete(sub)
          this.pumpChunks()
        })
      }
    }
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
    this.chunkMap.get(x)!.add(z)
    let loaded = false

    const chunkPos = {
      x: (x * this.chunkWidth) / 100,
      y: 0,
      z: (z * this.chunkDepth) / 100
    }

    // We first need to fetch the list of props, we cannot go further
    // with this chunk if this call fails
    return this.propSvc
      .props(
        this.worldId(),
        x * this.chunkWidth - this.chunkWidth / 2,
        x * this.chunkWidth + this.chunkWidth / 2,
        null,
        null,
        z * this.chunkDepth - this.chunkDepth / 2,
        z * this.chunkDepth + this.chunkDepth / 2
      )
      .pipe(
        mergeMap((props: {entries: PropEntry[]}) => {
          if (props.entries.length === 0) {
            loaded = true
            return EMPTY
          }
          // Pre-trigger all unique models upfront so .rwx requests queue ahead of textures
          for (const name of new Set(props.entries.map((p) => p[2]))) {
            this.propSvc.loadModel(name).pipe(take(1)).subscribe()
          }
          return from(props.entries).pipe(
            mergeMap(
              (prop: PropEntry) =>
                this.loadProp(
                  prop[0],
                  prop[2],
                  {x: prop[3], y: prop[4], z: prop[5]},
                  {x: prop[6], y: prop[7], z: prop[8]},
                  prop[1],
                  prop[9],
                  prop[10]
                ),
              16
            ),
            map((prop: Object3D) => {
              // Adjust the position of objects relative to the center of the block
              prop.position.sub(chunkPos)
              prop.updateMatrix()
              return prop
            }),
            toArray(), // Wait for all props to be loaded before proceeding
            map((objs: Object3D[]) => {
              loaded = true
              const chunkGroup = new Group().add(...objs)
              // Set metadata on the chunk
              chunkGroup.userData.world = {
                chunk: {x: chunkPos.x, z: chunkPos.z}
              }
              chunkGroup.userData.bvhInit = () =>
                PlayerCollider.queueChunkBVH(chunkGroup, this.workerSvc)
              chunkGroup.userData.bvhUpdate = new Subject()
              chunkGroup.userData.bvhUpdate
                .pipe(debounceTime(200))
                .subscribe(() => {
                  PlayerCollider.queueChunkBVH(chunkGroup, this.workerSvc)
                })
              const lod = new LOD()
              lod.userData.world = {chunk: {x, z}}
              lod.addLevel(chunkGroup, this.maxLodDistance)
              lod.addLevel(new Group(), this.maxLodDistance + 1)
              lod.position.copy(chunkPos)
              lod.autoUpdate = false
              lod.updateMatrix()
              lod.visible = false
              return lod
            })
          )
        }),
        catchError((err) => throwError(() => ({x, z, err}))),
        finalize(() => {
          if (!loaded) {
            this.chunkMap.get(x)?.delete(z)
          }
        })
      )
  }

  private setObjectChunk(object: Object3D) {
    const oldChunk = object.parent!
    const oldLOD = oldChunk.parent!
    const oldChunkPos = oldLOD.position
    const absPos = object.position.clone().add(oldChunkPos)
    const [chunkX, chunkZ] = this.getChunkTile(absPos)

    const newLOD = this.engineSvc
      .getLODs()
      .find(
        (lod) =>
          lod.userData.world.chunk.x === chunkX &&
          lod.userData.world.chunk.z === chunkZ
      )

    if (newLOD == null) {
      console.log(
        `Warning: Trying to move object ${object.name} to an uninitialized chunk (${chunkX}, ${chunkZ})`
      )
      return
    }
    oldChunk.remove(object)

    // Regenerate boundsTree for source LOD, if it's different from the destination one
    if (oldLOD !== newLOD) {
      oldChunk.userData.bvhUpdate.next()
    }

    const chunk = newLOD.levels[0].object
    chunk.add(object)
    object.position.add(oldChunkPos).sub(newLOD.position)
  }

  /**
   * Teleport within this world
   *
   * @param entry Teleport string
   */
  private teleport(entry: string | null) {
    const entryPoint = {x: 0, y: 0, z: 0}
    let entryYaw = 0
    if (entry) {
      const yawMatch = /\s([-+]?[0-9]+)$/.exec(entry)
      entryYaw = yawMatch ? parseInt(yawMatch[1], 10) : entryYaw
      Object.assign(entryPoint, stringToPos(entry))
    }

    // Load a few chunks on world initialization
    this.engineSvc.setPlayerPos(entryPoint, entryYaw)
    this.autoUpdateChunks(entryPoint)
    this.engineSvc.updateBoundingBox()
  }

  /**
   * Teleport to another world
   *
   * @param world World object from API
   * @param entry Teleport string
   * @returns Nothing
   */
  private setWorld(world: WorldData, entry: string | null) {
    if (!entry && world.entry) {
      entry = world.entry
    }

    if (this.worldId() === world.id) {
      this.teleport(entry)
      return
    }

    this.socket.messages.next({type: 'info', data: world.welcome ?? ''})

    this.cancelChunkLoading()
    this.worldId.set(world.id)
    this.worldName = world.name
    this.engineSvc.clearObjects()
    this.propSvc.cleanCache()
    this.anmSvc.cleanCache()
    if (this.propSvc.path() && this.propSvc.path() !== world.path) {
      Cache.clear()
      this.avatarList = []
      this.ownAvatar.set(null)
      for (const user of [...this.engineSvc.users()]) {
        this.engineSvc.removeUser(user)
      }
    }
    this.propSvc.path.set(world.path)
    this.engineSvc.gravity = world.gravity ?? 1
    this.terrainSvc.setTerrain(world?.terrain)
    this.terrainSvc.setWater(world?.water, true)
    this.skySvc.setSkybox(world.sky)
    this.lightingSvc.setLighting(world.light)

    this.getAvatars(this.propSvc.path()).subscribe((list) => {
      this.avatarList = list
      // Set first avatar on self
      const avatarMap = new Map<number, number>(
        this.settings.get('avatar') || []
      )
      this.ownAvatar.set(avatarMap.get(this.worldId()) || 0)
      // Force list update to create users now that avatars are known
      this.userSvc.userList.set([...this.userSvc.userList()])
    })

    this.resetChunks()
    this.teleport(entry)
  }

  private addUser(user: User) {
    if (user.id === this.authSvc.getLogged()().id) {
      return
    }
    const group = new Group()
    group.name = user.id
    group.position.set(user.x, user.y, user.z)
    group.rotation.set(user.roll, user.yaw, user.pitch)
    group.userData.player = true
    const avatarEntry = this.avatarList[user.avatar] ?? this.avatarList[0]
    this.setAvatar(
      avatarEntry.geometry,
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
