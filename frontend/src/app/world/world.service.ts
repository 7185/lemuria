import {Subject, Observable, throwError, from, of, firstValueFrom} from 'rxjs'
import type {Subscription} from 'rxjs'
import {mergeMap, concatMap, bufferCount, catchError} from 'rxjs/operators'
import {UserService} from '../user'
import {SettingsService} from '../settings/settings.service'
import type {User} from '../user'
import {EngineService, DEG} from '../engine/engine.service'
import {TerrainService} from './terrain.service'
import {TeleportService} from '../engine/teleport.service'
import {PlayerCollider} from '../engine/player-collider'
import {ObjectService, ObjectAct} from './object.service'
import {SocketService} from '../network/socket.service'
import {AnimationService} from '../animation/animation.service'
import type {AvatarAnimationManager} from '../animation/avatar-animation.manager'
import {HttpService} from '../network'
import {Injectable, effect, signal} from '@angular/core'
import type {WritableSignal} from '@angular/core'
import {config} from '../app.config'
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
import type {MeshPhongMaterial, Object3D} from 'three'
import {Utils} from '../utils'
import {BuildService} from '../engine/build.service'

@Injectable({providedIn: 'root'})
export class WorldService {
  public avatarList: {
    name: string
    geometry: string
    animationMgr: Promise<AvatarAnimationManager>
    implicit: Map<string, string>
    explicit: Map<string, string>
  }[] = []
  public avatarSub = new Subject<number>()
  public gestures = signal<Map<string, string>>(new Map())
  public worldId = 0
  public worldList = []
  public skybox = signal('')
  public skyTop: WritableSignal<string>
  public skyNorth: WritableSignal<string>
  public skyEast: WritableSignal<string>
  public skySouth: WritableSignal<string>
  public skyWest: WritableSignal<string>
  public skyBottom: WritableSignal<string>

  private worldName = 'Nowhere'
  private avatar: Group
  private previousLocalUserPos = null

  private propBatchSize: number = config.world.propBatchSize
  private chunkWidth: number = config.world.chunk.width // in cm
  private chunkDepth: number = config.world.chunk.depth // in cm
  private chunkMap: Map<number, Set<number>>
  private chunkLoadingLayout = []
  private chunkLoadCircular: boolean = config.world.chunk.loadCircular
  private chunkLoadRadius: number = config.world.chunk.loadRadius
  private prioritizeNearestChunks: boolean =
    config.world.chunk.prioritizeNearest

  private maxLodDistance: number = config.world.lod.maxDistance

  private uAvatarListener: Subscription
  private avatarListener: Subscription

  constructor(
    private engineSvc: EngineService,
    private terrainSvc: TerrainService,
    private userSvc: UserService,
    private objSvc: ObjectService,
    private anmSvc: AnimationService,
    private httpSvc: HttpService,
    private settings: SettingsService,
    private socket: SocketService,
    private teleportSvc: TeleportService,
    private buildSvc: BuildService
  ) {
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

      const currentPos = this.getPosition().position

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

      this.httpSvc.world(targetWorld.id).subscribe((w: any) => {
        this.socket.messages.next({type: 'info', data: w.welcome ?? ''})
        this.teleportSvc.teleportFrom(this.worldName, currentPos, isNew)

        this.setWorld(w, position)
      })
    })

    // Effect for skybox
    effect(() => {
      this.createSkybox(
        {
          top: Utils.hexToRgb(Utils.colorStrToHex(this.skyTop())),
          north: Utils.hexToRgb(Utils.colorStrToHex(this.skyNorth())),
          east: Utils.hexToRgb(Utils.colorStrToHex(this.skyEast())),
          south: Utils.hexToRgb(Utils.colorStrToHex(this.skySouth())),
          west: Utils.hexToRgb(Utils.colorStrToHex(this.skyWest())),
          bottom: Utils.hexToRgb(Utils.colorStrToHex(this.skyBottom()))
        },
        this.skybox()
      )
    })

    // Register texture animator to the engine
    effect(() => {
      if (this.engineSvc.texturesAnimation() > 0) {
        this.objSvc.texturesNextFrame()
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
    if (this.prioritizeNearestChunks) {
      this.chunkLoadingLayout.sort((c0, c1) => {
        const d0 = c0[0] * c0[0] + c0[1] * c0[1]
        const d1 = c1[0] * c1[0] + c1[1] * c1[1]
        if (d0 < d1) {
          return -1
        }
        if (d0 > d1) {
          return 1
        }
        return 0
      })
    }

    // Register chunk updater to the engine
    effect(() => {
      this.autoUpdateChunks(this.engineSvc.playerPosition())
    })

    // User list change
    effect(() => {
      for (const user of this.engineSvc.users()) {
        if (
          this.userSvc
            .userListSignal()
            .filter((u) => u.world === this.worldId)
            .map((u) => u.id)
            .indexOf(user.name) === -1
        ) {
          this.engineSvc.removeUser(user)
        }
      }
      for (const u of this.userSvc.userListSignal()) {
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
    this.objSvc.objectAction.subscribe((action: ObjectAct) => {
      if (action === ObjectAct.copy) {
        this.setObjectChunk(this.buildSvc.selectedProp)
      }
    })
  }

  public initWorld() {
    this.destroyWorld()

    this.avatar = new Group()
    this.avatar.name = 'avatar'
    this.engineSvc.attachCam(this.avatar)

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
      this.setAvatar(avatarEntry.geometry, animationManager, user as Group)
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
      this.setAvatar(avatarEntry.geometry, animationManager, this.avatar)
      const savedAvatars = this.settings.get('avatar')
      const avatarMap =
        savedAvatars != null
          ? new Map<number, number>(savedAvatars)
          : new Map<number, number>()
      avatarMap.set(this.worldId, avatarId)
      this.settings.set('avatar', Array.from(avatarMap.entries()))
    })
  }

  public destroyWorld() {
    this.resetChunks()
    this.engineSvc.resetChunkMap()
    this.uAvatarListener?.unsubscribe()
    this.avatarListener?.unsubscribe()
  }

  public setVisibility(visibility: number) {
    this.maxLodDistance = visibility
    this.engineSvc.setChunksDistance(visibility)
  }

  public getPosition() {
    return {
      world: this.worldName,
      position: Utils.posToString(
        this.engineSvc.getPosition()[0],
        this.engineSvc.getYaw()
      )
    }
  }

  private createSkybox(
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
    },
    skybox: string
  ) {
    const skyboxGroup = new Group()
    skyboxGroup.renderOrder = -1
    const octGeom = new BufferGeometry()

    // 6 vertices to make an octahedron
    // prettier-ignore
    const positions = [
       0.0,  0.0,  1.0, // north vertex (0)
      -1.0,  0.0,  0.0, // east vertex (1)
       0.0,  0.0, -1.0, // south vertex (2)
       1.0,  0.0,  0.0, // west vertex (3)
       0.0,  1.0,  0.0, // top vertex (4)
       0.0, -1.0,  0.0  // bottom vertex (5)
    ]

    const {top, north, east, south, west, bottom} = skyColors
    const colors = [...north, ...east, ...south, ...west, ...top, ...bottom]
      .map((v: number) => v / 255.0)
      // Vertex colors should be in linear space
      .map((c: number) =>
        c < 0.04045
          ? c * 0.0773993808
          : Math.pow(c * 0.9478672986 + 0.0521327014, 2.4)
      )
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
      this.objSvc.loadProp(skybox, true).subscribe((s) => {
        const skyboxRwx = s.clone()
        const box = new Box3()
        box.setFromObject(skyboxRwx)
        const center = box.getCenter(new Vector3())
        skyboxRwx.position.set(0, -center.y, 0)
        skyboxGroup.add(skyboxRwx)
      })
    }
    this.engineSvc.setSkybox(skyboxGroup)
  }

  private resetChunks() {
    this.previousLocalUserPos = null
    this.chunkMap = new Map<number, Set<number>>()
  }

  private async loadItem(
    id: number,
    item: string,
    pos: Vector3,
    rot: Vector3,
    date = 0,
    desc = null,
    act = null
  ): Promise<Object3D> {
    item = Utils.modelName(item)
    const o = await firstValueFrom(this.objSvc.loadProp(item))
    const g = o.clone()
    g.name = item
    g.userData.id = id
    g.userData.date = date
    g.userData.desc = desc
    g.userData.act = act
    g.traverse((child: Object3D) => {
      if (child instanceof Mesh) {
        child.material.forEach((m: MeshPhongMaterial) => {
          m.shininess = 0
        })
      }
    })
    const box = new Box3()
    box.setFromObject(g)
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

    if (act && g.userData?.isError !== true) {
      this.objSvc.execActions(g)
    }

    g.updateMatrix()
    return g
  }

  private setAvatar(
    name: string,
    animationMgr: Promise<AvatarAnimationManager>,
    group: Group
  ) {
    if (group == null) {
      // User not within this world
      return
    }
    name = Utils.modelName(name)
    this.objSvc.loadAvatar(name).subscribe((o) => {
      this.engineSvc.disposeMaterial(group)
      group.clear()
      o.rotation.copy(new Euler(0, Math.PI, 0))
      group.add(o.clone())
      const box = new Box3()
      box.setFromObject(group)
      group.userData.height = box.max.y - box.min.y
      group.userData.offsetY = group.position.y - box.min.y
      group.userData.animationPlayer = animationMgr.then((mgr) =>
        mgr.spawnAnimationPlayer(group)
      )
      if (group.name === 'avatar') {
        this.engineSvc.setCameraOffset(group.userData.height * 0.9)
        this.engineSvc.updateBoundingBox()
      } else {
        const user = this.userSvc.userList.find((u) => u.id === group.name)
        group.position.y = user.y + group.userData.offsetY
      }
    })
  }

  // Get chunk tile X and Z ids from position
  private getChunkTile(pos: Vector3) {
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
    const xPos = (tileX * this.chunkWidth) / 100.0
    const zPos = (tileZ * this.chunkDepth) / 100.0

    return new Vector3(xPos, 0, zPos)
  }

  // Return true if, given the provided chunk indices, this target chunk is different from the current one,
  // false otherwise
  private hasChunkChanged(chunkX: number, chunkZ: number) {
    if (this.previousLocalUserPos == null) {
      return true
    }
    const [previousChunkX, previousChunkZ] = this.getChunkTile(
      this.previousLocalUserPos
    )

    return !(previousChunkX === chunkX && previousChunkZ === chunkZ)
  }

  // this method is method to be called on each frame to update the state of chunks if needed
  private autoUpdateChunks(pos: Vector3) {
    const [chunkX, chunkZ] = this.getChunkTile(pos)
    this.engineSvc.setChunkTile(chunkX, chunkZ)

    if (this.worldId === 0 || !this.hasChunkChanged(chunkX, chunkZ)) {
      return
    }

    this.previousLocalUserPos?.copy(pos)

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
      return new Observable<LOD>((subscriber) => {
        subscriber.complete()
      })
    }

    // tag this chunk as being worked on already
    if (!this.chunkMap.has(x)) {
      this.chunkMap.set(x, new Set<number>())
    }
    this.chunkMap.get(x).add(z)

    const chunkPos = this.getChunkCenter(x, z)

    // We first need to fetch the list of props using HttpService, we cannot go further
    // with this chunk if this call fails
    return this.httpSvc
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
            bufferCount(props.entries.length, this.propBatchSize), // Pace the loading of items based on the desired batch size
            concatMap((arr) => from(arr)), // Each individual emission from bufferCount is an array of items
            mergeMap((item: any) =>
              this.loadItem(
                item[0],
                item[2],
                new Vector3(item[3], item[4], item[5]),
                new Vector3(item[6], item[7], item[8]),
                item[1],
                item[9],
                item[10]
              )
            ),
            mergeMap((item: Object3D) => {
              const chunkOffset = new Vector3(chunkPos.x, 0, chunkPos.z)
              item.position.sub(chunkOffset)
              if (item.userData.move !== undefined) {
                item.userData.move.orig.sub(chunkOffset)
              }
              item.updateMatrix()
              return of(item)
            }), // Adjust position of objects based on the center of the chunk
            bufferCount(props.entries.length), // Wait for all items to be loaded before proceeding
            mergeMap((objs: any) => of(new Group().add(...objs))), // Add all buffered objects to the chunkGroup
            mergeMap((chunkGroup: Group) => {
              // Set metadata on the chunk
              const lod = new LOD()
              lod.userData.rwx = {axisAlignment: 'none'}
              lod.userData.world = {chunk: {x, z}}

              chunkGroup.userData.rwx = {axisAlignment: 'none'}
              chunkGroup.userData.world = {
                chunk: {x: chunkPos.x, z: chunkPos.z}
              }

              lod.addLevel(chunkGroup, this.maxLodDistance)
              lod.addLevel(new Group(), this.maxLodDistance + 1)
              lod.position.set(chunkPos.x, 0, chunkPos.z)
              lod.autoUpdate = false
              lod.updateMatrix()
              chunkGroup.parent.visible = false
              PlayerCollider.updateChunkBVH(chunkGroup)

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

    for (const lod of this.engineSvc.getLODs()) {
      if (
        lod.userData.world.chunk.x === chunkX &&
        lod.userData.world.chunk.z === chunkZ
      ) {
        oldChunk.remove(object)

        // Regenerate boundsTree for source LOD, if it's different from the destination one
        if (oldLOD !== lod) {
          PlayerCollider.updateChunkBVH(oldChunk)
        }

        const chunk = lod.levels[0].object
        chunk.add(object)
        object.position.add(oldChunkPos).sub(lod.position)

        return
      }
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
  private teleport(entry: string) {
    const entryPoint = new Vector3()
    let entryYaw = 0
    if (entry) {
      const yawMatch = entry.match(/\s([-+]?[0-9]+)$/)
      entryYaw = yawMatch ? parseInt(yawMatch[1], 10) : entryYaw
      entryPoint.copy(Utils.stringToPos(entry))
    }

    // Load a few chunks on world initialization
    this.autoUpdateChunks(entryPoint)
    this.engineSvc.setPlayerPos(entryPoint, entryYaw)
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

    this.worldId = world.id
    this.worldName = world.name
    this.engineSvc.clearObjects()
    this.objSvc.cleanCache()
    this.anmSvc.cleanCache()
    this.objSvc.path.set(world.path)
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
    this.engineSvc.setAmbLightColor(
      Utils.rgbToHex(...(world.light.amb_color as [number, number, number]))
    )
    this.engineSvc.setDirLightColor(
      Utils.rgbToHex(...(world.light.dir_color as [number, number, number]))
    )
    this.engineSvc.setDirLightTarget(
      world.light.dir.x * 100,
      world.light.dir.y * 100,
      world.light.dir.z * 100
    )
    this.engineSvc.setWorldFog(
      Utils.rgbToHex(...(world.light.fog.color as [number, number, number])),
      world.light.fog.min,
      world.light.fog.max,
      world.light.fog.enabled
    )

    this.objSvc.loadAvatars().subscribe((list) => {
      this.avatarList = list
      // Set first avatar on self
      const savedAvatars = this.settings.get('avatar')
      const avatarMap =
        savedAvatars != null
          ? new Map<number, number>(savedAvatars)
          : new Map<number, number>()
      this.avatarSub.next(avatarMap.get(this.worldId) || 0)
      // Trigger list update to create users
      this.userSvc.userListSignal.set([...this.userSvc.userList])
    })

    this.terrainSvc.setTerrain(world)
    this.terrainSvc.setWater(world)
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
      this.engineSvc.createTextLabel(group)
      const avatarEntry = this.avatarList[user.avatar]
      this.setAvatar(
        this.avatarList[user.avatar].geometry || 'michel',
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
