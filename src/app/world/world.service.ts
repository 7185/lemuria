import {UserService} from './../user/user.service'
import {User} from './../user/user.model'
import {EngineService, DEG} from './../engine/engine.service'
import {ObjectService} from './object.service'
import {Injectable} from '@angular/core'
import {config} from '../app.config'
import {Euler, Mesh, Group, Vector3, PlaneGeometry, TextureLoader, RepeatWrapping, MeshPhongMaterial, DoubleSide,
  BoxGeometry, MeshBasicMaterial, BackSide, Vector2, Box3, Object3D} from 'three'
export const RES_PATH = config.url.resource

@Injectable({providedIn: 'root'})
export class WorldService {

  public avatarList: string[] = []
  private avatar: Group

  constructor(private engine: EngineService, private userSvc: UserService, private objSvc: ObjectService) {
  }

  initWorld() {
    const loader = new TextureLoader()

    const skyGeometry = new BoxGeometry(100, 100, 100)

    const skyMaterials = []
    const textureFt = loader.load(`${RES_PATH}/textures/faesky02back.jpg`)
    const textureBk = loader.load(`${RES_PATH}/textures/faesky02front.jpg`)
    const textureUp = loader.load(`${RES_PATH}/textures/faesky02up.jpg`)
    const textureDn = loader.load(`${RES_PATH}/textures/faesky02down.jpg`)
    const textureRt = loader.load(`${RES_PATH}/textures/faesky02right.jpg`)
    const textureLf = loader.load(`${RES_PATH}/textures/faesky02left.jpg`)
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

    const floorTexture = loader.load(`${RES_PATH}/textures/terrain17.jpg`)
    floorTexture.wrapS = RepeatWrapping
    floorTexture.wrapT = RepeatWrapping
    floorTexture.repeat.set(128, 128)

    const floorMaterial = new MeshPhongMaterial({map: floorTexture, side: DoubleSide})
    const floorGeometry = new PlaneGeometry(1000, 1000, 1, 1)
    const floor = new Group()
    const floorMesh = new Mesh(floorGeometry, floorMaterial)
    floorMesh.receiveShadow = true
    floor.add(floorMesh)
    floor.position.y = 0
    floor.rotation.x = -Math.PI / 2
    this.engine.addObject(floor)

    this.avatar = new Group()
    this.avatar.name = 'avatar'
    this.avatar.rotation.copy(new Euler(0, Math.PI, 0))
    this.engine.attachCam(this.avatar)
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

  public loadItem(item: string, pos: Vector3, rot: Vector3) {
    if (!item.endsWith('.rwx')) {
      item += '.rwx'
    }
    this.objSvc.loadObject(item).then((o) => {
      const g = o.clone()
      g.name = item
      g.traverse((child: Object3D) => {
        if (child instanceof Mesh) {
          child.castShadow = true
        }
      })
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
      const g = o.clone()
      g.traverse((child: Object3D) => {
        if (child instanceof Mesh) {
          child.castShadow = true
          child.receiveShadow = true
        }
      })
      group.clear()
      group.add(g)
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
    })
  }

  public setWorld(data: any) {
    for (const item of this.engine.objects().filter(i => i.name.length > 0 && !i.userData?.persist)) {
      this.engine.removeObject(item as Group)
    }
    this.objSvc.setPath(data.path)
    this.avatarList = data.avatars
    this.setAvatar(this.avatarList[0], this.avatar)
    for (const item of data.objects) {
      this.loadItem(item[0], new Vector3(item[1], item[2], item[3]), new Vector3(item[4], item[5], item[6]))
    }
    // Update avatars
    for (const u of this.userSvc.userList) {
      const user = this.engine.objects().find(o => o.name === u.id)
      if (user != null) {
        if (u.avatar >= this.avatarList.length) {
          u.avatar = 0
        }
        this.setAvatar(this.avatarList[u.avatar], user as Group)
      }
    }
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
