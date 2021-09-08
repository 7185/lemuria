import {Subject} from 'rxjs'
import {Injectable} from '@angular/core'
import {HttpService} from './../network/http.service'
import {Group, Mesh, ConeGeometry, LoadingManager, MeshBasicMaterial} from 'three'
import type {MeshPhongMaterial, Object3D} from 'three'
import RWXLoader, {RWXMaterialManager} from 'three-rwx-loader'
import * as JSZip from 'jszip'
import JSZipUtils from 'jszip-utils'

// can't be const (angular#25963)
export enum ObjectAct { nop = 0, forward, backward, left, right, up, down, rotX, rotnX, rotY, rotnY, rotZ, rotnZ,
   copy, delete, rotReset, snapGrid, deselect }

@Injectable({providedIn: 'root'})
export class ObjectService {

  public objectAction = new Subject<ObjectAct>()
  private errorCone: Group
  private rwxLoader = new RWXLoader(new LoadingManager())
  private basicLoader = new RWXLoader(new LoadingManager())
  private rwxMaterialManager: RWXMaterialManager
  private objects: Map<string, Promise<any>> = new Map()
  private path = 'http://localhost'

  constructor(private http: HttpService) {
    const coneGeometry = new ConeGeometry(0.5, 0.5, 3)
    coneGeometry.clearGroups()
    coneGeometry.addGroup(0, coneGeometry.getIndex().count, 0)
    const cone = new Mesh(coneGeometry, [new MeshBasicMaterial({color: 0x000000})])
    cone.position.y = 0.5
    this.errorCone = new Group().add(cone)
    this.errorCone.userData.isError = true
    this.rwxMaterialManager = new RWXMaterialManager(this.path, 'jpg', 'zip', JSZip, JSZipUtils)
    this.rwxLoader.setRWXMaterialManager(this.rwxMaterialManager).setFlatten(true)
    this.basicLoader.setJSZip(JSZip, JSZipUtils).setFlatten(true).setUseBasicMaterial(true)
  }

  setPath(path: string) {
    this.path = path
    this.rwxMaterialManager.folder = `${this.path}/textures`
    this.rwxLoader.setPath(`${this.path}/rwx`).setResourcePath(`${this.path}/textures`)
    this.basicLoader.setPath(`${this.path}/rwx`).setResourcePath(`${this.path}/textures`)
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
            const newRWXMat = m.userData.rwx.material.clone()
            newRWXMat.texture = textureName
            newRWXMat.mask = maskName
            if (color != null) {
              newRWXMat.color = [color.r / 255.0, color.g / 255.0, color.b / 255.0]
            }
            this.rwxMaterialManager.currentRWXMaterial = newRWXMat
            newMaterials.push(this.rwxMaterialManager.getCurrentMaterial().threeMat)
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
    this.rwxMaterialManager.resetCurrentMaterialList()
  }

  loadObject(name: string, basic = false): Promise<any> {
    if (this.objects.get(name) !== undefined) {
      return this.objects.get(name)
    } else {
      const loader = basic ? this.basicLoader : this.rwxLoader
      const promise = new Promise((resolve) => {
        loader.load(name, (rwx: Group) => resolve(rwx), null, () => resolve(this.errorCone))
      })
      this.objects.set(name, promise)
      return promise
    }
  }

  cleanCache() {
    this.objects = new Map()
  }

  public texturesNextFrame() {
    this.rwxMaterialManager.texturesNextFrame()
  }
}
