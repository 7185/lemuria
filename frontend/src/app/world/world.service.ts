import {inject, Injectable, signal} from '@angular/core'
import {toObservable} from '@angular/core/rxjs-interop'
import type {Observable, Subscription} from 'rxjs'
import {
  catchError,
  concatMap,
  debounceTime,
  EMPTY,
  firstValueFrom,
  from,
  map,
  mergeMap,
  Subject,
  takeUntil,
  throwError,
  toArray
} from 'rxjs'
import type {Object3D, Vector3Like} from 'three'
import {Box3, Euler, Group, LOD, Vector3} from 'three'
import type {User} from '../user'
import {UserService} from '../user'
import {SettingsService} from '../settings/settings.service'
import {EngineService} from '../engine/engine.service'
import type {TerrainData, WaterData} from './terrain.service'
import {TerrainService} from './terrain.service'
import {TeleportService} from '../engine/teleport.service'
import {PlayerCollider} from '../engine/player-collider'
import type {PropCtl} from './prop.service'
import {PropService} from './prop.service'
import {PropActionService} from './prop-action.service'
import type {Avatar, PropEntry} from '../network'
import {HttpService, SocketService} from '../network'
import type {AvatarAnimationManager} from '../animation'
import {AvatarAnimationService} from '../animation'
import {environment} from '../../environments/environment'
import {DEG} from '../utils/constants'
import {modelName, posToStringYaw, stringToPos} from '../utils/utils'
import {BuildService} from '../engine/build.service'
import type {LightData} from './lighting.service'
import {LightingService} from './lighting.service'
import type {SkyData} from './sky.service'
import {SkyService} from './sky.service'

interface WorldData {
  id: number
  name: string
  sky: SkyData
  path: string
  welcome?: string
  terrain?: TerrainData
  entry?: string
  water?: WaterData
  light: LightData
}

@Injectable({providedIn: 'root'})
export class WorldService {
  avatarList: Avatar[] = []
  avatarSub = new Subject<number>()
  gestures = signal<Map<string, string>>(new Map())
  worldId = 0
  worldList = signal<{id: number; name: string; users: number}[]>([])

  private readonly engineSvc = inject(EngineService)
  private readonly skySvc = inject(SkyService)
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

  private cancelPropsLoading = new Subject<void>()
  private worldName = 'Nowhere'
  private lastChunk: number[] = []

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

        this.http.world(targetWorld.id).subscribe((w: WorldData) => {
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

    // Register chunk updater to the engine
    toObservable(this.engineSvc.playerPosition).subscribe((position) => {
      this.autoUpdateChunks(position)
      this.terrainSvc.getTerrainPages(position.x, position.z, 1)
    })

    // User list change
    toObservable(this.userSvc.userList).subscribe((userList) => {
      for (const user of this.engineSvc.users()) {
        if (
          !userList
            .filter((u) => u.world === this.worldId)
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
          u.world !== this.worldId
        ) {
          continue
        }
        this.addUser(u)
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
        this.setObjectChunk(this.buildSvc.selectedProp())
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
      const avatarMap = new Map<number, number>(
        this.settings.get('avatar') || []
      )
      avatarMap.set(this.worldId, avatarId)
      this.settings.set('avatar', Array.from(avatarMap.entries()))
    })
  }

  destroyWorld() {
    this.cancelPropsLoading.next()
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
      position: posToStringYaw(this.engineSvc.position[0], this.engineSvc.yaw)
    }
  }

  private resetChunks() {
    this.lastChunk = []
    this.chunkMap.clear()
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
      o.rotation.copy(new Euler(0, Math.PI, 0))
      group.parent!.updateMatrixWorld()
      group.position.setY(group.parent!.position.y)
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
  private getChunkTile(pos: Vector3Like): [number, number] {
    const tileX = Math.floor(
      (Math.floor(pos.x * 100) + this.chunkWidth / 2) / this.chunkWidth
    )
    const tileZ = Math.floor(
      (Math.floor(pos.z * 100) + this.chunkDepth / 2) / this.chunkDepth
    )

    return [tileX, tileZ]
  }

  // this method is to be called on each position change to update the state of chunks if needed
  private autoUpdateChunks(pos: Vector3Like) {
    if (this.worldId === 0) {
      // Nowhere
      return
    }
    const [chunkX, chunkZ] = this.getChunkTile(pos)
    this.engineSvc.currentChunk = [chunkX, chunkZ]

    // Do nothing if the current chunk didn't change
    if (
      this.lastChunk.length &&
      this.lastChunk[0] === chunkX &&
      this.lastChunk[1] === chunkZ
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
        error: (val) => {
          console.error(val.err)
          if (this.chunkMap.get(val.x)?.has(val.z)) {
            this.chunkMap.get(val.x)!.delete(val.z)
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
    this.chunkMap.get(x)!.add(z)

    const chunkPos = {
      x: (x * this.chunkWidth) / 100,
      y: 0,
      z: (z * this.chunkDepth) / 100
    }

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
        takeUntil(this.cancelPropsLoading),
        mergeMap((props: {entries: PropEntry[]}) => {
          if (props.entries.length === 0) {
            return EMPTY
          }
          return from(props.entries).pipe(
            mergeMap((prop: PropEntry) =>
              this.loadProp(
                prop[0],
                prop[2],
                {x: prop[3], y: prop[4], z: prop[5]},
                {x: prop[6], y: prop[7], z: prop[8]},
                prop[1],
                prop[9],
                prop[10]
              )
            ),
            takeUntil(this.cancelPropsLoading),
            map((prop: Object3D) => {
              // Adjust position of objects based on the center of the chunk
              prop.position.sub(chunkPos)
              prop.updateMatrix()
              return prop
            }),
            toArray(), // Wait for all props to be loaded before proceeding
            map((objs: Object3D[]) => {
              const chunkGroup = new Group().add(...objs)
              // Set metadata on the chunk
              chunkGroup.userData.world = {
                chunk: {x: chunkPos.x, z: chunkPos.z}
              }
              chunkGroup.userData.bvhUpdate = new Subject()
              chunkGroup.userData.bvhUpdate
                .pipe(debounceTime(200))
                .subscribe(() => {
                  PlayerCollider.updateChunkBVH(chunkGroup)
                })
              chunkGroup.userData.bvhUpdate.next()
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
        catchError((err) => throwError(() => ({x, z, err})))
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
  private setWorld(world: WorldData, entry: string | null) {
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
    this.skySvc.setSkybox(world.sky)
    this.lightingSvc.setLighting(world.light)

    this.http.avatars(this.propSvc.path()).subscribe((list) => {
      this.avatarList = list
      // Set first avatar on self
      const avatarMap = new Map<number, number>(
        this.settings.get('avatar') || []
      )
      this.avatarSub.next(avatarMap.get(this.worldId) || 0)
      // Force list update to create users now that avatars are known
      this.userSvc.userList.set([...this.userSvc.userList()])
    })

    this.resetChunks()
    this.teleport(entry)
  }

  private addUser(user: User) {
    if (user.id === this.http.getLogged()().id) {
      return
    }
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
