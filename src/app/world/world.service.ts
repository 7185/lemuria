import {Subject, Observable, throwError, from, of} from 'rxjs'
import type {Subscription} from 'rxjs'
import {mergeMap, concatMap, bufferCount, catchError} from 'rxjs/operators'
import {UserService} from './../user/user.service'
import type {User} from './../user/user.model'
import {EngineService, DEG} from './../engine/engine.service'
import {ObjectService, ObjectAct} from './object.service'
import {HttpService} from './../network/http.service'
import {Injectable} from '@angular/core'
import {config} from '../app.config'
import {AWActionParser} from 'aw-action-parser'
import {Euler, Mesh, Group, Vector3, PlaneGeometry, TextureLoader, RepeatWrapping, LOD,
  BoxGeometry, MeshBasicMaterial, BackSide, Vector2, Box3, BufferAttribute} from 'three'
import type {Object3D} from 'three'
import Utils from '../utils/utils'
export const RES_PATH = config.url.resource

@Injectable({providedIn: 'root'})
export class WorldService {

  public avatarList: {name: string; geometry: string}[] = []
  public avatarSub = new Subject<number>()
  private avatar: Group
  private textureLoader: TextureLoader
  private actionParser = new AWActionParser()
  private terrain: Group
  private worldId: number
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
    private httpSvc: HttpService) {

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
    this.engine.localUserPosObservable().subscribe((pos: Vector3) => { this.autoUpdateChunks(pos) })

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
    this.textureLoader = new TextureLoader()
    const skyGeometry = new BoxGeometry(100, 100, 100)

    this.resetChunks()

    const skyMaterials = []
    const textureFt = this.textureLoader.load(`${RES_PATH}/textures/faesky02back.jpg`)
    const textureBk = this.textureLoader.load(`${RES_PATH}/textures/faesky02front.jpg`)
    const textureUp = this.textureLoader.load(`${RES_PATH}/textures/faesky02up.jpg`)
    const textureDn = this.textureLoader.load(`${RES_PATH}/textures/faesky02down.jpg`)
    const textureRt = this.textureLoader.load(`${RES_PATH}/textures/faesky02right.jpg`)
    const textureLf = this.textureLoader.load(`${RES_PATH}/textures/faesky02left.jpg`)
    textureUp.center = new Vector2(0.5, 0.5)
    textureUp.rotation = Math.PI / 2
    textureDn.center = new Vector2(0.5, 0.5)
    textureDn.rotation = Math.PI / 2

    skyMaterials.push(new MeshBasicMaterial({map: textureFt, depthWrite: false, side: BackSide}))
    skyMaterials.push(new MeshBasicMaterial({map: textureBk, depthWrite: false, side: BackSide}))
    skyMaterials.push(new MeshBasicMaterial({map: textureUp, depthWrite: false, side: BackSide}))
    skyMaterials.push(new MeshBasicMaterial({map: textureDn, depthWrite: false, side: BackSide}))
    skyMaterials.push(new MeshBasicMaterial({map: textureRt, depthWrite: false, side: BackSide}))
    skyMaterials.push(new MeshBasicMaterial({map: textureLf, depthWrite: false, side: BackSide}))

    const skybox = new Group()
    skybox.add(new Mesh(skyGeometry, skyMaterials))
    skybox.name = 'skybox'
    this.engine.addWorldObject(skybox)

    this.avatar = new Group()
    this.avatar.name = 'avatar'
    this.avatar.rotation.copy(new Euler(0, Math.PI, 0))
    this.engine.attachCam(this.avatar)

    // listeners
    this.uListListener = this.userSvc.listChanged.subscribe((userList: User[]) => {
      for (const user of this.engine.users()) {
        if (userList.map(u => u.id).indexOf(user.name) === -1) {
          this.engine.removeUser(user as Group)
        }
      }
      for (const u of userList) {
        const user = this.engine.users().find(o => o.name === u.id)
        if (user == null) {
          this.addUser(u)
        }
      }
    })

    this.uAvatarListener = this.userSvc.avatarChanged.subscribe((u) => {
      const user = this.engine.users().find(o => o.name === u.id)
      const avatarId = u.avatar >= this.avatarList.length ? 0 : u.avatar
      this.setAvatar(this.avatarList[avatarId].geometry, user as Group)
    })

    this.avatarListener = this.avatarSub.subscribe((avatarId) => {
      this.setAvatar(this.avatarList[avatarId].geometry)
    })
  }

  destroyWorld() {
    this.uAvatarListener.unsubscribe()
    this.uListListener.unsubscribe()
    this.avatarListener.unsubscribe()
  }

  public resetChunks() {
    this.previousLocalUserPos = null
    this.chunkMap = new Map<number, Set<number>>()
  }

  public initTerrain(elev: any) {
    if (this.terrain != null) {
      this.engine.removeWorldObject(this.terrain)
    }

    this.terrain = new Group()
    this.terrain.name = 'terrain'
    const terrainTexture = this.textureLoader.load(`${RES_PATH}/textures/terrain17.jpg`)
    terrainTexture.wrapS = RepeatWrapping
    terrainTexture.wrapT = RepeatWrapping
    terrainTexture.repeat.set(128, 128)

    const terrainMaterial = [new MeshBasicMaterial({map: terrainTexture})]

    if (elev != null) {
      for (const d of Object.entries(elev)) {
        const geometry = new PlaneGeometry(1280, 1280, 128, 128)
        geometry.rotateX(-Math.PI / 2)

        const positions = new Float32Array(geometry.attributes.position.array)
        let gap = 0
        for (let i = 0, j = 0; i < positions.length; i++, j += 3) {
          if (i % 128 !== 0) {
            positions[j + 1 + gap * 3] = d[1][i] / 100 || 0
          } else {
            // skip edge
            gap++
          }
        }
        geometry.setAttribute('position', new BufferAttribute(positions, 3))
        geometry.addGroup(0, geometry.getIndex().count, 0)

        const terrainMesh = new Mesh(geometry, terrainMaterial)
        const pos = d[0].split('_').map(p => parseInt(p, 10))
        // move terrain by 1E (-10x)
        terrainMesh.position.set(pos[0] * 10 - 10, 0, pos[1] * 10)
        this.terrain.add(terrainMesh)
      }
    } else {
      const geometry = new PlaneGeometry(1280, 1280, 128, 128)
      geometry.rotateX(-Math.PI / 2)
      geometry.addGroup(0, geometry.getIndex().count, 0)
      const terrainMesh = new Mesh(geometry, terrainMaterial)
      this.terrain.add(terrainMesh)
    }
    this.engine.addWorldObject(this.terrain)
    this.engine.refreshOctree()
  }

  public execActions(item: Group) {
    const result = this.actionParser.parse(item.userData.act)
    if (result.create != null) {
      for (const cmd of result.create) {
        if (cmd.commandType === 'solid') {
          item.userData.notSolid = !cmd.value
        }
        if (cmd.commandType === 'visible') {
          item.visible = cmd.value
        } else {
          if (cmd.commandType === 'color') {
            this.objSvc.applyTexture(item, null, null, cmd.color)
          } else {
            if (cmd.commandType === 'texture') {
              if (cmd.texture) {
                cmd.texture = cmd.texture.lastIndexOf('.') !== -1 ? cmd.texture.substring(0, cmd.texture.lastIndexOf('.')) : cmd.texture
                if (cmd.mask) {
                  cmd.mask = cmd.mask.lastIndexOf('.') !== -1 ? cmd.mask.substring(0, cmd.mask.lastIndexOf('.')) : cmd.mask
                }
              }
              this.objSvc.applyTexture(item, cmd.texture, cmd.mask)
            }
          }
        }
        if (cmd.commandType === 'move') {
          item.userData.move = {
            distance: cmd.distance,
            time: cmd.time || 1,
            loop: cmd.loop || false,
            reset: cmd.reset || false,
            wait: cmd.wait || 0,
            waiting: 0,
            completion: 0,
            direction: 1,
            orig: item.position.clone()
          }
        }
        if (cmd.commandType === 'rotate') {
          item.userData.rotate = {
            speed: cmd.speed,
            time: cmd.time || null,
            loop: cmd.loop || false,
            reset: cmd.reset || false,
            wait: cmd.wait || 0,
            waiting: 0,
            completion: 0,
            direction: 1,
            orig: item.rotation.clone()
          }
        }
      }
    }
  }

  public async loadItem(item: string, pos: Vector3, rot: Vector3, date = 0, desc = null, act = null): Promise<Object3D> {
    if (!item.endsWith('.rwx')) {
      item += '.rwx'
    }
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
      this.execActions(g)
    }

    g.updateMatrix()
    return g
  }

  setAvatar(name: string, group: Group = this.avatar) {
    if (!name.endsWith('.rwx')) {
      name += '.rwx'
    }
    this.objSvc.loadObject(name).then((o) => {
      this.engine.disposeMaterial(group)
      group.clear()
      group.add(o.clone())
      const box = new Box3()
      box.setFromObject(group)
      group.userData.height = box.max.y - box.min.y
      group.userData.offsetY = group.position.y - box.min.y
      if (group.name === 'avatar') {
        this.engine.setCameraOffset(group.userData.height * 0.9)
        this.engine.updateCapsule()
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
    this.objSvc.setPath(world.path)
    this.objSvc.loadAvatars().subscribe((list) => {
      this.avatarList = list
      this.avatarSub.next(0)
    })
    this.initTerrain(world.elev)

    this.resetChunks()

    const entry = new Vector3(0, 0, 0)
    if (world.entry) {
      entry.copy(Utils.stringToPos(world.entry))
    }

    // Load a few chunks on world initialization
    this.autoUpdateChunks(entry)

    this.engine.teleport(entry)

    // Trigger list update to create users
    this.userSvc.listChanged.next(this.userSvc.userList)
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

  // this method is method to be called on each frame to update the state of chunks if needed
  public autoUpdateChunks(pos: Vector3) {
    const [chunkX, chunkZ] = this.getChunkTile(pos)

    // Only trigger a chunk update if we've actually moved to another chunk
    if (this.previousLocalUserPos !== null) {
      const [previousChunkX, previousChunkZ] = this.getChunkTile(this.previousLocalUserPos)

      if (previousChunkX === chunkX && previousChunkZ === chunkZ) {
        return
      }
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

            return of(lod)
          })
        )
      ),
      catchError(err => throwError(() => ({x, z, err})))
    )
  }

  private setObjectChunk(object: Object3D) {
    const oldChunkPos = object.parent.parent.position
    const absPos = object.position.clone().add(oldChunkPos)
    const [chunkX, chunkZ] = this.getChunkTile(absPos)
    for (const lod of this.engine.getLODs()) {
      if (lod.userData.world.chunk.x === chunkX && lod.userData.world.chunk.z === chunkZ) {
        object.parent.remove(object)
        lod.levels[0].object.add(object)
        object.position.add(oldChunkPos).sub(object.parent.parent.position)
        return
      }
    }
    console.log(`Warning: Trying to move object ${object.name} to an uninitialized chunk (${chunkX}, ${chunkZ})`)
  }

  private addUser(u: User) {
    if (u.name !== this.userSvc.currentName) {
      let avatar = this.avatarList[u.avatar].geometry || 'michel'
      if (!avatar.endsWith('.rwx')) {
        avatar += '.rwx'
      }
      const group = new Group()
      group.name = u.id
      group.position.x = u.x
      group.position.y = u.y
      group.position.z = u.z
      group.rotation.x = u.roll
      group.rotation.y = u.yaw + Math.PI
      group.rotation.z = u.pitch
      group.userData.player = true
      this.engine.createTextLabel(group)
      this.setAvatar(avatar, group)
      this.engine.addUser(group)
    }
  }
}
