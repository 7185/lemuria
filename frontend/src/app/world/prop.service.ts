import * as fflate from 'fflate'
import {computed, effect, Injectable, signal} from '@angular/core'
import {Observable, Subject} from 'rxjs'
import {
  BufferAttribute,
  BufferGeometry,
  Group,
  LoadingManager,
  Mesh,
  MeshBasicMaterial
} from 'three'
import RWXLoader, {flattenGroup, RWXMaterialManager} from 'three-rwx-loader'
import {modelName} from '../utils/utils'

export type PropCtl = [
  'nop',
  'forward',
  'backward',
  'left',
  'right',
  'up',
  'down',
  'rotX',
  'rotnX',
  'rotY',
  'rotnY',
  'rotZ',
  'rotnZ',
  'copy',
  'delete',
  'rotReset',
  'snapGrid',
  'deselect'
][number]

@Injectable({providedIn: 'root'})
export class PropService {
  propControl = new Subject<PropCtl>()
  path = signal('')
  animatedPictures = []
  rwxMaterialManager: RWXMaterialManager
  audioPath = computed(() => `${this.path()}/sounds`)
  resPath = computed(() => `${this.path()}/textures`)
  private unknown = this.createUnknownProp()
  private rwxPropLoader = new RWXLoader(new LoadingManager())
  private basicLoader = new RWXLoader(new LoadingManager())
  private objects = new Map<string, Observable<Group>>()
  private avatars = new Map<string, Observable<Group>>()
  private geomCache = new Map<string, BufferGeometry>()

  constructor() {
    this.rwxMaterialManager = new RWXMaterialManager(
      this.path(),
      '.jpg',
      '.zip',
      fflate
    )
    this.rwxPropLoader.setRWXMaterialManager(this.rwxMaterialManager)
    this.basicLoader.setFflate(fflate).setUseBasicMaterial(true)

    effect(() => {
      const resPath = this.resPath()
      const rwxPath = `${this.path()}/rwx`

      this.rwxMaterialManager.folder = resPath
      this.basicLoader.setPath(rwxPath).setResourcePath(resPath)
      this.rwxPropLoader.setPath(rwxPath).setResourcePath(resPath)
    })
  }

  loadModel(name: string, basic = false): Observable<Group> {
    return this.loadRwxObject(name, this.objects, basic ? 'basic' : 'prop')
  }

  loadAvatar(name: string): Observable<Group> {
    return this.loadRwxObject(name, this.avatars, 'prop')
  }

  cleanCache() {
    this.objects.clear()
    this.avatars.clear()
    this.animatedPictures.length = 0
    this.rwxMaterialManager.clear()
    this.geomCache.clear()
  }

  texturesNextFrame() {
    this.rwxMaterialManager.texturesNextFrame()
    for (const m of this.animatedPictures) {
      const anim = m.userData.rwx.animation
      if (anim != null) {
        anim.step = (anim.step + 1) % anim.yTiles
        m.map.offset.y = 1 - anim.yHeight * (anim.step + 1)
        m.needsUpdate = true
      }
    }
  }

  private createUnknownProp() {
    const unknownGeometry = new BufferGeometry()
    const positions = [-0.2, 0, 0, 0.2, 0, 0, 0, 0.2, 0]
    unknownGeometry.setAttribute(
      'position',
      new BufferAttribute(new Float32Array(positions), 3)
    )
    unknownGeometry.setIndex([0, 1, 2])
    unknownGeometry.clearGroups()
    unknownGeometry.addGroup(0, unknownGeometry.getIndex()!.count, 0)
    const unknown = new Group().add(
      new Mesh(unknownGeometry, [new MeshBasicMaterial({color: 0x000000})])
    )
    unknown.userData.isError = true
    return unknown
  }

  /**
   * Loads a prop or an avatar
   * @param name Name of the model
   * @param objectCache Cache to be used
   * @param loaderType Type of the loader
   * @returns
   */
  private loadRwxObject(
    name: string,
    objectCache: Map<string, Observable<Group>>,
    loaderType = 'basic'
  ) {
    name = modelName(name)
    const object = objectCache.get(name)
    if (object !== undefined) {
      return object
    }

    const loader = loaderType === 'prop' ? this.rwxPropLoader : this.basicLoader
    const observable = new Observable<Group>((observer) => {
      loader.load(
        name,
        (rwx: Group) => {
          // We flatten everything except RWX with tags (usually avatars)
          let hasTag = false
          rwx.traverse((child) => {
            if (child.userData.rwx?.tag) {
              hasTag = true
            }
          })
          if (!hasTag) {
            rwx = flattenGroup(rwx)
          }
          if (rwx instanceof Mesh) {
            // Caching should probably be done by the loader
            // but this is still better than nothing
            if (this.geomCache.has(name)) {
              rwx.geometry = this.geomCache.get(name)
            } else {
              this.geomCache.set(name, rwx.geometry)
            }
          }
          observer.next(rwx)
        },
        null,
        () => observer.next(this.unknown.clone())
      )
    })
    objectCache.set(name, observable)
    return observable
  }
}
