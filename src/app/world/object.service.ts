import {Injectable} from '@angular/core'
import RWXLoader from 'three-rwx-loader'
import {Group, Mesh, ConeGeometry, LoadingManager, MeshBasicMaterial} from 'three'
import * as JSZip from 'jszip'
import JSZipUtils from 'jszip-utils'

@Injectable({providedIn: 'root'})
export class ObjectService {

  private errorCone: Group
  private rwxLoader = new RWXLoader(new LoadingManager())
  private objects: Map<string, Promise<any>> = new Map()
  private path = 'http://localhost'

  constructor() {
    const cone = new Mesh(new ConeGeometry(0.5, 0.5, 3), new MeshBasicMaterial({color: 0x000000}))
    cone.position.y = 0.5
    this.errorCone = new Group().add(cone)
    this.rwxLoader.setJSZip(JSZip, JSZipUtils)
  }

  setPath(path: string) {
    this.path = path
    this.rwxLoader.setPath(`${this.path}/rwx`).setResourcePath(`${this.path}/textures`)
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
  }
}
