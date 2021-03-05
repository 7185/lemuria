import {UserService} from './../user/user.service'
import {User} from './../user/user.model'
import {EngineService} from './../engine/engine.service'
import {Injectable} from '@angular/core'
import {config} from '../app.config'
import {Euler, Mesh, LoadingManager, Vector3, PlaneGeometry, TextureLoader, RepeatWrapping, MeshPhongMaterial, DoubleSide,
  BoxGeometry, MeshBasicMaterial, BackSide, Vector2} from 'three'
import {RWXLoader} from '../utils/rwxloader'
import * as JSZip from 'jszip'
import JSZipUtils from 'jszip-utils'


export const RES_PATH = config.url.resource

@Injectable({providedIn: 'root'})
export class WorldService {

  public avatarList: string[] = []
  private avatar: Mesh

  private rwxLoader = new RWXLoader(new LoadingManager())

  constructor(private engine: EngineService, private userSvc: UserService) {
    this.rwxLoader.setPath(`${RES_PATH}/rwx`).setResourcePath(`${RES_PATH}/textures`).setJSZip(JSZip, JSZipUtils)
  }

  initWorld() {
    const loader = new TextureLoader()

    const skyGeometry = new BoxGeometry(10, 10, 10)

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

    const skybox = new Mesh(skyGeometry, skyMaterials)
    skybox.name = 'skybox'
    this.engine.addMesh(skybox)

    const floorTexture = loader.load(`${RES_PATH}/textures/terrain17.jpg`)
    floorTexture.wrapS = RepeatWrapping
    floorTexture.wrapT = RepeatWrapping
    floorTexture.repeat.set(128, 128)

    const floorMaterial = new MeshPhongMaterial({map: floorTexture, side: DoubleSide})
    const floorGeometry = new PlaneGeometry(100, 100, 1, 1)
    const floor = new Mesh(floorGeometry, floorMaterial)
    floor.position.y = 0
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    this.engine.addMesh(floor)

    this.initAvatar()
    this.engine.attachCam(this.avatar)
    for (const u of this.userSvc.userList) {
      this.addUser(u)
    }
    this.userSvc.listChanged.subscribe(() => {
      for (const user of this.engine.objects().filter(o => o.userData?.player)) {
        if (this.userSvc.userList.map(u => u.id).indexOf(user.name) === -1) {
          this.engine.removeMesh(user as Mesh)
          document.getElementById('label-' + user.name).remove()
        }
      }
      for (const u of this.userSvc.userList) {
        const user = this.engine.objects().find(o => o.name === u.id)
        if (user == null) {
          this.addUser(u)
        }
      }
    })

    this.userSvc.avatarChanged.subscribe((u) => {
      const user = this.engine.objects().find(o => o.name === u.id)
      this.setAvatar(this.avatarList[u.avatar], user as Mesh)
    })
  }

  initAvatar() {
    this.avatar = new Mesh()
    this.avatar.name = 'avatar'
    this.avatar.position.copy(new Vector3(0, 0.11, 0))
    this.avatar.rotation.copy(new Euler(0, Math.PI, 0))
    this.avatar.castShadow = true
    this.avatar.receiveShadow = true
    this.setAvatar('michel.rwx', this.avatar)
  }

  public loadItem(item: string, pos: Vector3) {
    if (!item.endsWith('.rwx')) {
      item += '.rwx'
    }
    this.rwxLoader.load(item, (rwx: Mesh) => {
      const mesh = new Mesh()
      mesh.geometry = rwx.geometry
      mesh.material = rwx.material
      mesh.name = item
      mesh.position.x = pos.x
      mesh.position.y = pos.y
      mesh.position.z = pos.z
      mesh.castShadow = true
      this.engine.addMesh(mesh)
    })
  }

  setAvatar(name: string, mesh: Mesh = this.avatar) {
    if (!name.endsWith('.rwx')) {
      name += '.rwx'
    }
    this.rwxLoader.load(name, (rwx: Mesh) => {
      mesh.geometry = rwx.geometry
      mesh.material = rwx.material
    })
  }

  public setWorld(data: any) {
    for (const item of this.engine.objects().filter(i => i.name.length > 0 && !i.userData?.player && i.name !== 'skybox')) {
      this.engine.removeMesh(item as Mesh)
    }
    for (const item of data.objects) {
      this.loadItem(item[0], new Vector3(item[1], item[2], item[3]))
    }
    this.avatarList = data.avatars
    // Update avatars
    for (const u of this.userSvc.userList) {
      const user = this.engine.objects().find(o => o.name === u.id)
      if (user != null) {
        this.setAvatar(this.avatarList[u.avatar], user as Mesh)
      }
    }
  }

  private addUser(u: User) {
    if (u.name !== this.userSvc.currentName) {
      let avatar = this.avatarList[u.avatar] || 'michel'
      if (!avatar.endsWith('.rwx')) {
        avatar += '.rwx'
      }
      const mesh = new Mesh()
      mesh.castShadow = true
      mesh.name = u.id
      mesh.position.x = u.x
      mesh.position.y = u.y
      mesh.position.z = u.z
      mesh.rotation.x = u.roll
      mesh.rotation.y = u.yaw + Math.PI
      mesh.rotation.z = u.pitch
      mesh.userData.player = true
      this.engine.createTextLabel(mesh)
      this.setAvatar(avatar, mesh)
      this.engine.addMesh(mesh)
    }
  }
}
