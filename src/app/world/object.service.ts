import {Injectable} from '@angular/core'
import {HttpService} from './../network/http.service'
import {Group, Mesh, ConeGeometry, LoadingManager, MeshBasicMaterial, Texture, RepeatWrapping,
  TextureLoader, MeshPhongMaterial, Object3D} from 'three'
import RWXLoader, {makeThreeMaterial} from 'three-rwx-loader'
import * as JSZip from 'jszip'
import JSZipUtils from 'jszip-utils'

@Injectable({providedIn: 'root'})
export class ObjectService {

  private errorCone: Group
  private rwxLoader = new RWXLoader(new LoadingManager())
  private objects: Map<string, Promise<any>> = new Map()
  private textures: Map<string, any> = new Map()
  private path = 'http://localhost'

  constructor(private http: HttpService) {
    const coneGeometry = new ConeGeometry(0.5, 0.5, 3)
    coneGeometry.clearGroups()
    coneGeometry.addGroup(0, coneGeometry.getIndex().count, 0)
    const cone = new Mesh(coneGeometry, [new MeshBasicMaterial({color: 0x000000})])
    cone.position.y = 0.5
    this.errorCone = new Group().add(cone)
    this.rwxLoader.setJSZip(JSZip, JSZipUtils).setFlatten(true)
  }

  setPath(path: string) {
    this.path = path
    this.rwxLoader.setPath(`${this.path}/rwx`).setResourcePath(`${this.path}/textures`)
  }

  loadAvatars() {
    return this.http.avatars(this.path)
  }

  applyTexture(item: Group, textureName: string = null, maskName: string = null, color: any = null) {
    item.traverse((child: Object3D) => {
      if (child instanceof Mesh) {
        const newMaterials = []
        child.material.forEach((m: MeshPhongMaterial) => {
          if (m.userData.rwx.material != null) {
            const newRWXMat = m.userData.rwx.material
            newRWXMat.texture = textureName
            newRWXMat.mask = maskName
            if (color != null) {
              newRWXMat.color = [color.r/255.0, color.g/255.0, color.b/255.0]
            }
            newMaterials.push(makeThreeMaterial(newRWXMat, `${this.path}/textures`, 'jpg', 'zip', JSZip, JSZipUtils).phongMat)
          }
          if (m.alphaMap != null) {
            m.alphaMap.dispose()
          }
          if (m.map != null) {
            m.map.dispose()
          }
          m.dispose()
        })
        child.material = newMaterials
        child.material.needsUpdate = true
      }
    })
  }

  loadTexture(name: string, loader: TextureLoader): any {
    let texture: Texture
    if (this.textures.get(name) !== undefined) {
      texture = this.textures.get(name)
    } else {
      texture = loader.load(`${this.path}/textures/${name}`)
      texture.wrapS = RepeatWrapping
      texture.wrapT = RepeatWrapping
      this.textures.set(name, texture)
    }
    const material = new MeshPhongMaterial({map: texture})
    material.needsUpdate = true
    return material
  }

  loadObject(name: string): Promise<any> {
    if (this.objects.get(name) !== undefined) {
      return this.objects.get(name)
    } else {
      const promise = new Promise((resolve, reject) => {
        this.rwxLoader.load(name, (rwx: Group) => resolve(rwx), null, () => resolve(this.errorCone))
      })
      this.objects.set(name, promise)
      return promise
    }
  }

  cleanCache() {
    this.objects = new Map()
    this.textures = new Map()
  }
}
