import {Subject, Observable, throwError, from, of} from 'rxjs'
import type {Subscription} from 'rxjs'
import {mergeMap, concatMap, bufferCount, catchError} from 'rxjs/operators'
import {UserService} from '../user/user.service'
import {SettingsService} from '../settings/settings.service'
import type {User} from '../user/user.model'
import {EngineService, DEG} from '../engine/engine.service'
import {ObjectService, ObjectAct} from './object.service'
import {AnimationService} from '../animation/animation.service'
import type {AvatarAnimationManager} from '../animation/avatar.animation.manager'
import {HttpService} from '../network/http.service'
import {Injectable} from '@angular/core'
import {config} from '../app.config'
import {Euler, Mesh, Group, Vector3, PlaneGeometry, TextureLoader, RepeatWrapping, LOD, BufferGeometry,
  MeshBasicMaterial, Box3, BufferAttribute, sRGBEncoding} from 'three'
import type {Object3D} from 'three'
import Utils from '../utils/utils'

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
  public animationMapSub = new Subject<Map<string, string>>()
  public worldId = 0
  private avatar: Group
  private textureLoader = new TextureLoader()
  private terrain: Group
  private previousLocalUserPos = null

  private propBatchSize: number = config.world.propBatchSize
  private chunkWidth: number = config.world.chunk.width // in cm
  private chunkDepth: number = config.world.chunk.depth // in cm
  private chunkMap: Map<number, Set<number>>
  private chunkLoadingLayout = []
  private chunkLoadCircular: boolean = config.world.chunk.loadCircular
  private chunkLoadRadius: number = config.world.chunk.loadRadius
  private prioritizeNearestChunks: boolean = config.world.chunk.prioritizeNearest

  private maxLodDistance: number = config.world.lod.maxDistance

  private uListListener: Subscription
  private uAvatarListener: Subscription
  private avatarListener: Subscription

  constructor(private engine: EngineService, private userSvc: UserService, private objSvc: ObjectService,
    private anmSvc: AnimationService, private httpSvc: HttpService, private settings: SettingsService) {

    for (let i = -this.chunkLoadRadius; i <= this.chunkLoadRadius; i++) {
      for (let j = -this.chunkLoadRadius; j <= this.chunkLoadRadius; j++) {

        // Only keep chunks within a certain circular radius (if circular loadin is enabled)
        if (!this.chunkLoadCircular || (i * i + j * j) < this.chunkLoadRadius * this.chunkLoadRadius) {
           this.chunkLoadingLayout.push([i, j])
        }

      }
    }

    // For extra comfort: we can sort each chunk in the layout based on there distance to the center,
    // this ought to make de client load and display nearest chunks first
    if (this.prioritizeNearestChunks) {
        this.chunkLoadingLayout.sort((c0, c1) => {
            const d0 = (c0[0] * c0[0] + c0[1] * c0[1])
            const d1 = (c1[0] * c1[0] + c1[1] * c1[1])
            if (d0 < d1) { return -1 }
            if (d0 > d1) { return 1 }
            return 0
        })
    }

    // Register chunk updater to the engine
    this.engine.localUserPosObservable().subscribe((pos: Vector3) => {
      this.autoUpdateChunks(pos)
    })

    // Register texture animator to the engine
    this.engine.texturesAnimationObservable().subscribe(() => { this.objSvc.texturesNextFrame() })

    // Register object chunk updater to the engine
    this.objSvc.objectAction.subscribe((action: ObjectAct) => {
      switch (action) {
        case (ObjectAct.up):
        case (ObjectAct.down):
        case (ObjectAct.forward):
        case (ObjectAct.backward):
        case (ObjectAct.left):
        case (ObjectAct.right):
        case (ObjectAct.snapGrid):
        case (ObjectAct.copy): {
          this.setObjectChunk(this.engine.selectedObject)
          break
        }
        default:
          return
      }
    })
  }

  initWorld() {
    this.destroyWorld()

    this.avatar = new Group()
    this.avatar.name = 'avatar'
    this.engine.attachCam(this.avatar)

    // listeners
    this.uListListener = this.userSvc.listChanged.subscribe((userList: User[]) => {
      for (const user of this.engine.users()) {
        if (userList.filter(u => u.world === this.worldId).map(u => u.id).indexOf(user.name) === -1) {
          this.engine.removeUser(user as Group)
        }
      }
      for (const u of userList) {
        const user = this.engine.users().find(o => o.name === u.id)
        if (user == null && this.avatarList.length > 0 && u.world === this.worldId) {
          this.addUser(u)
        }
      }
    })

    // other avatars
    this.uAvatarListener = this.userSvc.avatarChanged.subscribe((u) => {
      const user = this.engine.users().find(o => o.name === u.id)
      const avatarId = u.avatar >= this.avatarList.length ? 0 : u.avatar
      const avatarEntry = this.avatarList[avatarId]
      const animationManager: Promise<AvatarAnimationManager> = this.anmSvc.getAvatarAnimationManager(avatarEntry.name,
        avatarEntry.implicit, avatarEntry.explicit)
      this.setAvatar(avatarEntry.geometry, animationManager, user as Group)
    })

    // own avatar
    this.avatarListener = this.avatarSub.subscribe((avatarId: number) => {
      this.animationMapSub.next(this.avatarList[avatarId].explicit)
      const avatarEntry = this.avatarList[avatarId]
      const animationManager: Promise<AvatarAnimationManager> = this.anmSvc.getAvatarAnimationManager(avatarEntry.name,
        avatarEntry.implicit, avatarEntry.explicit)
      this.setAvatar(avatarEntry.geometry, animationManager)
      const savedAvatars = JSON.parse(this.settings.get('avatar'))
      const avatarMap = savedAvatars != null ? new Map<number, number>(savedAvatars) : new Map<number, number>()
      avatarMap.set(this.worldId, avatarId)
      this.settings.set('avatar', JSON.stringify(Array.from(avatarMap.entries())))
    })
  }

  public destroyWorld() {
    this.resetChunks()
    this.engine.resetChunkMap()
    this.uAvatarListener?.unsubscribe()
    this.uListListener?.unsubscribe()
    this.avatarListener?.unsubscribe()
  }

  public resetChunks() {
    this.previousLocalUserPos = null
    this.chunkMap = new Map<number, Set<number>>()
  }

  public initTerrain(world: any) {
    if (this.terrain != null) {
      this.engine.removeWorldObject(this.terrain)
    }
    if (world.terrain) {
      this.terrain = new Group()
      this.terrain.name = 'terrain'
      const terrainMaterials = []

      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 64; j++) {
          const terrainTexture = this.textureLoader.load(`${world.path}/textures/terrain${j}.jpg`)
          terrainTexture.encoding = sRGBEncoding
          terrainTexture.wrapS = RepeatWrapping
          terrainTexture.wrapT = RepeatWrapping
          terrainTexture.rotation = i * Math.PI / 2
          terrainTexture.repeat.set(128, 128)
          terrainMaterials.push(new MeshBasicMaterial({map: terrainTexture}))
        }
      }

      if (world.elev != null) {
        for (const d of Object.entries(world.elev)) {
          const geometry = new PlaneGeometry(1280, 1280, 128, 128)
          geometry.rotateX(-Math.PI / 2)

          const positions = new Float32Array(geometry.attributes.position.array)
          let gap = 0
          for (let i = 0, j = 0; i < positions.length; i++, j += 3) {
            if (i % 128 !== 0) {
              if (d[1][i] != null) {
                positions[j + 1 + gap * 3] = d[1][i][0] / 100
              } else {
                positions[j + 1 + gap * 3] = 0
              }
            } else {
              // skip edge
              gap++
            }
          }
          geometry.setAttribute('position', new BufferAttribute(positions, 3))

          let changeTexture = 0
          let currTexture = 0
          for (let k = 0; k < 128 * 128; k++) {
            if (d[1][k] != null) {
              if (d[1][k][1] !== currTexture) {
                geometry.addGroup(changeTexture, k * 6 - changeTexture, currTexture)
                changeTexture = k * 6
                currTexture = d[1][k][1]
              }
            } else if (currTexture !== 0) {
              geometry.addGroup(changeTexture, k * 6 - changeTexture, currTexture)
              changeTexture = k * 6
              currTexture = 0
            }
          }

          geometry.addGroup(changeTexture, geometry.getIndex().count, currTexture)

          const terrainMesh = new Mesh(geometry, terrainMaterials)
          const pos = d[0].split('_').map(p => parseInt(p, 10))
          // move terrain by 1E (-10x)
          terrainMesh.position.set(pos[0] * 10 - 10, 0, pos[1] * 10)
          this.terrain.add(terrainMesh)
        }
      } else {
        const geometry = new PlaneGeometry(1280, 1280, 128, 128)
        geometry.rotateX(-Math.PI / 2)
        geometry.addGroup(0, geometry.getIndex().count, 0)
        const terrainMesh = new Mesh(geometry, terrainMaterials)
        this.terrain.add(terrainMesh)
      }
    } else {
      this.terrain = null
    }
    if (this.terrain != null) {
      this.engine.addWorldObject(this.terrain)
      this.terrain.updateMatrixWorld()
    }
    this.engine.updateTerrainBVH(this.terrain)
  }


  public async loadItem(item: string, pos: Vector3, rot: Vector3, date = 0, desc = null, act = null): Promise<Object3D> {
    item = Utils.modelName(item)
    const o = await this.objSvc.loadObject(item)
    const g = o.clone()
    g.name = item
    g.userData.date = date
    g.userData.desc = desc
    g.userData.act = act
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
    g.rotation.set(rot.x * DEG / 10, rot.y * DEG / 10, rot.z * DEG / 10, 'YZX')

    if (act && g.userData?.isError !== true) {
      this.objSvc.execActions(g)
    }

    g.updateMatrix()
    return g
  }

  setAvatar(name: string, animationMgr: Promise<AvatarAnimationManager>, group: Group = this.avatar) {
    name = Utils.modelName(name)
    this.objSvc.loadAvatar(name).then((o) => {
      this.engine.disposeMaterial(group)
      group.clear()
      o.rotation.copy(new Euler(0, Math.PI, 0))
      group.add(o.clone())
      const box = new Box3()
      box.setFromObject(group)
      group.userData.height = box.max.y - box.min.y
      group.userData.offsetY = group.position.y - box.min.y
      group.userData.animationPlayer = animationMgr.then(mgr => mgr.spawnAnimationPlayer(group))
      if (group.name === 'avatar') {
        this.engine.setCameraOffset(group.userData.height * 0.9)
        this.engine.updateBoundingBox()
      } else {
        const user = this.userSvc.userList.find(u => u.id === group.name)
        group.position.y = user.y + group.userData.offsetY
      }
    })
  }

  setVisibility(visibility: number) {
    this.maxLodDistance = visibility
    this.engine.setChunksDistance(visibility)
  }

  public setWorld(world: any) {
    this.worldId = world.id
    this.engine.clearObjects()
    this.objSvc.cleanCache()
    this.anmSvc.cleanCache()
    this.objSvc.path.next(world.path)

    const skyboxGroup = new Group()
    skyboxGroup.renderOrder = -1
    const octGeom = new BufferGeometry()

    // 6 vertices to make an octahedron
    const positions = [
       0.0,  0.0,  1.0, // north vertex (0)
      -1.0,  0.0,  0.0, // east vertex (1)
       0.0,  0.0, -1.0, // south vertex (2)
       1.0,  0.0,  0.0, // west vertex (3)
       0.0,  1.0,  0.0, // top vertex (4)
       0.0, -1.0,  0.0  // bottom vertex (5)
    ]

    const wsc = world.sky_color
    const colors = wsc.north.concat(wsc.east, wsc.south, wsc.west, wsc.top, wsc.bottom).map((v: number) => v / 255.0)

    octGeom.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
    octGeom.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3))

    // 8 triangle faces to make an octahedron
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

    const oct = new Mesh(octGeom, [new MeshBasicMaterial({vertexColors: true, depthWrite: false})])
    skyboxGroup.add(oct)

    if (world.skybox) {
      world.skybox = Utils.modelName(world.skybox)
      this.objSvc.loadObject(world.skybox, true).then(s => {
        const skybox = s.clone()
        const box = new Box3()
        box.setFromObject(skybox)
        const center = box.getCenter(new Vector3())
        skybox.position.set(0, -center.y, 0)
        skyboxGroup.add(skybox)
      })
    }

    this.engine.setSkybox(skyboxGroup)

    this.objSvc.loadAvatars().subscribe((list) => {
      this.avatarList = list
      // Set first avatar on self
      const savedAvatars = JSON.parse(this.settings.get('avatar'))
      const avatarMap = savedAvatars != null ? new Map<number, number>(savedAvatars) : new Map<number, number>()
      this.avatarSub.next(avatarMap.get(this.worldId) || 0)
      // Trigger list update to create users
      this.userSvc.listChanged.next(this.userSvc.userList)
    })

    this.initTerrain(world)

    this.resetChunks()

    const entry = new Vector3(0, 0, 0)
    let entryYaw = 0
    if (world.entry) {
      const yawMatch = world.entry.match(/\s([0-9]+)$/)
      entryYaw = yawMatch ? parseInt(yawMatch[1], 10) : entryYaw
      entry.copy(Utils.stringToPos(world.entry))
    }

    // Load a few chunks on world initialization
    this.autoUpdateChunks(entry)

    this.engine.teleport(entry, entryYaw)
  }

  // Get chunk tile X and Z ids from position
  public getChunkTile(pos: Vector3) {
    const tileX = Math.floor((Math.floor(pos.x * 100) + this.chunkWidth / 2) / this.chunkWidth)
    const tileZ = Math.floor((Math.floor(pos.z * 100) + this.chunkDepth / 2) / this.chunkDepth)

    return [tileX, tileZ]
  }

  // Get chunk position from tile X and Z ids
  public getChunkCenter(tileX: number, tileZ: number) {
    const xPos = (tileX * this.chunkWidth) / 100.0
    const zPos = (tileZ * this.chunkDepth) / 100.0

    return new Vector3(xPos, 0, zPos)
  }

  // Return true if, given the provided chunk indices, this target chunk is different from the current one,
  // false otherwise
  public hasChunkChanged(chunkX: number, chunkZ: number) {
    if (this.previousLocalUserPos !== null) {
      const [previousChunkX, previousChunkZ] = this.getChunkTile(this.previousLocalUserPos)

      if (previousChunkX === chunkX && previousChunkZ === chunkZ) {
        return false
      }
    }
    return true
  }

  // this method is method to be called on each frame to update the state of chunks if needed
  public autoUpdateChunks(pos: Vector3) {
    const [chunkX, chunkZ] = this.getChunkTile(pos)
    this.engine.setChunkTile(chunkX, chunkZ)

    if (this.worldId === 0 || !this.hasChunkChanged(chunkX, chunkZ)) {
      return
    }

    this.previousLocalUserPos = pos.clone()

    // For clarity: we get an Observable from loadChunk, if it produces anything: we take care of it
    // in subscribe() (note that if the chunk has already been loaded, it won't reach the operator).
    // We also tag the chunk as not being loaded if any error were to happen (like a failed http request)
    from(this.chunkLoadingLayout)
      .pipe(concatMap(val => this.loadChunk(chunkX + val[0], chunkZ + val[1])))
      .subscribe({
        next: (chunk: LOD) => { this.engine.addChunk(chunk) },
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
      return new Observable<any>(subscriber => { subscriber.complete() })
    }

    // tag this chunk as being worked on already
    if (this.chunkMap.has(x)) {
      this.chunkMap.get(x).add(z)
    } else {
      this.chunkMap.set(x, new Set<number>())
      this.chunkMap.get(x).add(z)
    }

    const chunkPos = this.getChunkCenter(x, z)

    // We first need to fetch the list of props using HttpService, we cannot go further
    // with this chunk if this call fails
    return this.httpSvc.props(this.worldId,
      (x * this.chunkWidth) - (this.chunkWidth / 2),
      (x * this.chunkWidth) + (this.chunkWidth / 2),
      null, null,
      (z * this.chunkDepth) - (this.chunkDepth / 2),
      (z * this.chunkDepth) + (this.chunkDepth / 2))
      .pipe(
        concatMap((props: any) => from(props.entries).pipe(
          bufferCount(props.entries.length, this.propBatchSize), // Pace the loading of items based on the desired batch size
          concatMap(arr => from(arr)), // Each individual emission from bufferCount is an array of items
          mergeMap((item: any) => this.loadItem(item[1], new Vector3(item[2], item[3], item[4]),
                                                new Vector3(item[5], item[6], item[7]),
                                                item[0], item[8], item[9])
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
          mergeMap((objs: any) => of((new Group()).add(...objs))), // Add all buffered objects to the chunkGroup
          mergeMap((chunkGroup: Group) => {
            // Set metadata on the chunk
            const lod = new LOD()
            lod.userData.rwx = {axisAlignment: 'none'}
            lod.userData.world = {chunk: {x, z}}

            chunkGroup.userData.rwx = {axisAlignment: 'none'}
            chunkGroup.userData.world = {chunk: {x: chunkPos.x, z: chunkPos.z}}

            lod.addLevel(chunkGroup, this.maxLodDistance)
            lod.addLevel(new Group(), this.maxLodDistance + 1)
            lod.position.set(chunkPos.x, 0, chunkPos.z)
            lod.autoUpdate = false
            lod.updateMatrix()
            chunkGroup.parent.visible = false
            this.engine.updateChunkBVH(chunkGroup)

            return of(lod)
          })
        )
      ),
      catchError(err => throwError(() => ({x, z, err})))
    )
  }

  private setObjectChunk(object: Object3D) {
    const oldChunk = object.parent as Group
    const oldLOD = oldChunk.parent
    const oldChunkPos = oldLOD.position
    const absPos = object.position.clone().add(oldChunkPos)
    const [chunkX, chunkZ] = this.getChunkTile(absPos)

    for (const lod of this.engine.getLODs()) {
      if (lod.userData.world.chunk.x === chunkX && lod.userData.world.chunk.z === chunkZ) {
        oldChunk.remove(object)

        // Regenerate boundsTree for source LOD, if it's different from the destination one
        if (oldLOD !== lod) {
          this.engine.updateChunkBVH(oldChunk)
        }

        const chunk = lod.levels[0].object
        chunk.add(object)
        object.position.add(oldChunkPos).sub(lod.position)

        return
      }
    }
    console.log(`Warning: Trying to move object ${object.name} to an uninitialized chunk (${chunkX}, ${chunkZ})`)
  }

  private addUser(user: User) {
    if (user.name !== this.userSvc.currentName) {
      const avatar = Utils.modelName(this.avatarList[user.avatar].geometry || 'michel')
      const group = new Group()
      group.name = user.id
      group.position.set(user.x, user.y, user.z)
      group.rotation.set(user.roll, user.yaw, user.pitch)
      group.userData.player = true
      this.engine.createTextLabel(group)
      const avatarEntry = this.avatarList[user.avatar]
      this.setAvatar(avatar,
                     this.anmSvc.getAvatarAnimationManager(avatarEntry.name, avatarEntry.implicit, avatarEntry.explicit),
                     group)
      this.engine.addUser(group)
    }
  }
}
