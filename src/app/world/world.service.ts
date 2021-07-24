import {UserService} from './../user/user.service'
import {User} from './../user/user.model'
import {EngineService, DEG} from './../engine/engine.service'
import {ObjectService} from './object.service'
import {Injectable} from '@angular/core'
import {config} from '../app.config'
import {AWActionParser} from 'aw-action-parser'
import {Euler, Mesh, Group, Vector3, PlaneGeometry, TextureLoader, RepeatWrapping, MeshPhongMaterial, DoubleSide,
  BoxGeometry, MeshBasicMaterial, BackSide, Vector2, Box3, Object3D} from 'three'
export const RES_PATH = config.url.resource

@Injectable({providedIn: 'root'})
export class WorldService {

  public avatarList: string[] = []
  private avatar: Group
  private textureLoader: TextureLoader
  private actionParser = new AWActionParser()

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
    skybox.userData.persist = true
    this.engine.addObject(skybox)

    const floorTexture = this.textureLoader.load(`${RES_PATH}/textures/terrain17.jpg`)
    floorTexture.wrapS = RepeatWrapping
    floorTexture.wrapT = RepeatWrapping
    floorTexture.repeat.set(128, 128)

    const floorMaterial = new MeshPhongMaterial({map: floorTexture, side: DoubleSide})
    const floorGeometry = new PlaneGeometry(1000, 1000, 1, 1)
    const floor = new Group()
    const floorMesh = new Mesh(floorGeometry, floorMaterial)
    floorMesh.receiveShadow = true
    floor.add(floorMesh)
    floor.name = 'ground'
    floor.userData.persist = true
    floor.position.y = -0.01
    floor.rotation.x = -Math.PI / 2
    this.engine.addObject(floor)
    this.engine.addMeshToOctree(floor)

    this.avatar = new Group()
    this.avatar.name = 'avatar'
    this.avatar.rotation.copy(new Euler(0, Math.PI, 0))
    this.engine.attachCam(this.avatar)

    // listeners
    this.userSvc.listChanged.subscribe((userList: User[]) => {
      for (const user of this.engine.objects().filter(o => o.userData?.player)) {
        if (userList.map(u => u.id).indexOf(user.name) === -1) {
          this.engine.removeObject(user as Group)
          document.getElementById('label-' + user.name).remove()
        }
      }
      for (const u of userList) {
        const user = this.engine.objects().find(o => o.name === u.id)
        if (user == null) {
          this.addUser(u)
        }
      }
    })

    this.userSvc.avatarChanged.subscribe((u) => {
      const user = this.engine.objects().find(o => o.name === u.id)
      const avatarId = u.avatar >= this.avatarList.length ? 0 : u.avatar
      this.setAvatar(this.avatarList[avatarId], user as Group)
    })
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
            const color = `rgb(${cmd.color.r},${cmd.color.g},${cmd.color.b})`
            this.engine.disposeMaterial(item)
            item.traverse((child: Object3D) => {
              if (child instanceof Mesh) {
                child.material = new MeshPhongMaterial({color})
                child.material.flatShading = true
              }
            })
          } else {
            if (cmd.commandType === 'texture') {
              let textureMat = cmd.texture
              if (!textureMat.endsWith('.jpg')) {
                textureMat += '.jpg'
              }
              textureMat = this.objSvc.loadTexture(textureMat, this.textureLoader)
              this.engine.disposeMaterial(item)
              item.traverse((child: Object3D) => {
                if (child instanceof Mesh) {
                  child.material = textureMat
                }
              })
            }
          }
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
      g.traverse((child: Object3D) => {
        if (child instanceof Mesh) {
          child.castShadow = true
        }
      })
      if (act) {
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
      o.traverse((child: Object3D) => {
        if (child instanceof Mesh) {
          child.castShadow = true
          child.receiveShadow = true
        }
      })
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
    for (const item of this.engine.objects().filter(i => i.name.length > 0 && !i.userData?.persist)) {
      this.engine.removeObject(item as Group)
    }
    this.objSvc.cleanCache()
    this.objSvc.setPath(data.path)
    this.avatarList = data.avatars
    this.setAvatar(this.avatarList[0], this.avatar)
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
      let avatar = this.avatarList[u.avatar] || 'michel'
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
      this.engine.addObject(group)
    }
  }
}
