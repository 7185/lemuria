import {Subscription} from 'rxjs'
import {UserService} from './../user/user.service'
import {User} from './../user/user.model'
import {EngineService, DEG} from './../engine/engine.service'
import {ObjectService} from './object.service'
import {Injectable} from '@angular/core'
import {config} from '../app.config'
import {AWActionParser} from 'aw-action-parser'
import {Euler, Mesh, Group, Vector3, PlaneGeometry, TextureLoader, RepeatWrapping,
  BoxGeometry, MeshBasicMaterial, BackSide, Vector2, Box3, BufferAttribute} from 'three'
export const RES_PATH = config.url.resource

@Injectable({providedIn: 'root'})
export class WorldService {

  public avatarList: {name: string; geometry: string}[] = []
  private avatar: Group
  private textureLoader: TextureLoader
  private actionParser = new AWActionParser()
  private terrain: Group

  private uListListener: Subscription
  private uAvatarListener: Subscription

  constructor(private engine: EngineService, private userSvc: UserService, private objSvc: ObjectService) {
  }

  initWorld() {
    this.textureLoader = new TextureLoader()
    const skyGeometry = new BoxGeometry(100, 100, 100)

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
  }

  destroyWorld() {
    this.uAvatarListener.unsubscribe()
    this.uListListener.unsubscribe()
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
        if (cmd.commandType === 'rotate') {
          item.userData.rotate = cmd.speed
        }
      }
    }
  }

  public loadItem(item: string, pos: Vector3, rot: Vector3, date=0, desc=null, act=null) {
    if (!item.endsWith('.rwx')) {
      item += '.rwx'
    }
    this.objSvc.loadObject(item).then((o) => {
      const g = o.clone()
      g.name = item
      g.userData.date = date
      g.userData.desc = desc
      g.userData.act = act
      if (act && g.userData?.isError !== true) {
        this.execActions(g)
      }
      g.position.set(pos.x / 100, pos.y / 100, pos.z / 100)
      g.rotation.set(rot.x * DEG / 10, rot.y * DEG / 10, rot.z * DEG / 10, 'YZX')
      this.engine.addObject(g)
    })
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
      group.userData.offsetY = -box.min.y
      if (group.userData.height > 1.1) {
        group.position.y += group.userData.offsetY
      } else {
        group.position.y = 0
      }
      if (group.name === 'avatar') {
        this.engine.setCameraOffset(group.userData.height * 0.9)
      }
      this.engine.updateCapsule()
    })
  }

  public setWorld(data: any) {
    // Children is a dynamic iterable, we need a copy to get all of them
    for (const item of [...this.engine.objects()]) {
      this.engine.removeObject(item as Group)
    }
    this.objSvc.cleanCache()
    this.objSvc.setPath(data.path)
    this.objSvc.loadAvatars().subscribe((list) => {
      this.avatarList = list
      this.setAvatar(this.avatarList[0].geometry, this.avatar)
    })
    this.initTerrain(data.elev)
    for (const item of data.objects) {
      this.loadItem(item[1], new Vector3(item[2], item[3], item[4]), new Vector3(item[5], item[6], item[7]),
                    item[0], item[8], item[9])
    }
    if (data.entry) {
      this.engine.teleport(data.entry)
    }
    // Trigger list update to create users
    this.userSvc.listChanged.next(this.userSvc.userList)
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
