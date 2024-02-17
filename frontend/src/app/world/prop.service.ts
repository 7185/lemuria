import {Observable, Subject} from 'rxjs'
import {computed, effect, Injectable, signal} from '@angular/core'
import {
  Group,
  Mesh,
  BufferAttribute,
  BufferGeometry,
  LoadingManager,
  MeshBasicMaterial,
  SRGBColorSpace
} from 'three'
import RWXLoader, {RWXMaterialManager} from 'three-rwx-loader'
import * as fflate from 'fflate'
import {Utils} from '../utils'

const propCtls = [
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
] as const
export type PropCtl = (typeof propCtls)[number]

@Injectable({providedIn: 'root'})
export class PropService {
  public propControl = new Subject<PropCtl>()
  public path = signal('')
  public animatedPictures = []
  public rwxMaterialManager: RWXMaterialManager
  public audioPath = computed(() => `${this.path()}/sounds`)
  public resPath = computed(() => `${this.path()}/textures`)
  private rwxPath = computed(() => `${this.path()}/rwx`)
  private unknown: Group
  private rwxPropLoader = new RWXLoader(new LoadingManager())
  private rwxAvatarLoader = new RWXLoader(new LoadingManager())
  private basicLoader = new RWXLoader(new LoadingManager())
  private objects: Map<string, Observable<Group>> = new Map()
  private avatars: Map<string, Observable<Group>> = new Map()
  private geomCache: Map<string, BufferGeometry> = new Map()

  constructor() {
    const unknownGeometry = new BufferGeometry()
    const positions = [-0.2, 0, 0, 0.2, 0, 0, 0, 0.2, 0]
    unknownGeometry.setAttribute(
      'position',
      new BufferAttribute(new Float32Array(positions), 3)
    )
    unknownGeometry.setIndex([0, 1, 2])
    unknownGeometry.clearGroups()
    unknownGeometry.addGroup(0, unknownGeometry.getIndex().count, 0)
    this.unknown = new Group().add(
      new Mesh(unknownGeometry, [new MeshBasicMaterial({color: 0x000000})])
    )
    this.unknown.userData.isError = true
    this.rwxMaterialManager = new RWXMaterialManager(
      this.path(),
      '.jpg',
      '.zip',
      fflate,
      false,
      SRGBColorSpace
    )
    this.rwxPropLoader
      .setRWXMaterialManager(this.rwxMaterialManager)
      .setFlatten(true)
    this.rwxAvatarLoader.setRWXMaterialManager(this.rwxMaterialManager)
    this.basicLoader
      .setFflate(fflate)
      .setFlatten(true)
      .setUseBasicMaterial(true)
      .setTextureColorSpace(SRGBColorSpace)

    effect(() => {
      this.rwxMaterialManager.folder = this.resPath()
      this.basicLoader.setPath(this.rwxPath()).setResourcePath(this.resPath())
      this.rwxPropLoader.setPath(this.rwxPath()).setResourcePath(this.resPath())
      this.rwxAvatarLoader
        .setPath(this.rwxPath())
        .setResourcePath(this.resPath())
    })
  }

  public loadModel(name: string, basic = false): Observable<Group> {
    return this.loadRwxObject(name, this.objects, basic ? 'basic' : 'prop')
  }

  public loadAvatar(name: string): Observable<Group> {
    return this.loadRwxObject(name, this.avatars, 'avatar')
  }

  public cleanCache() {
    this.objects.clear()
    this.avatars.clear()
    this.animatedPictures.length = 0
    this.rwxMaterialManager.clear()
    this.geomCache.clear()
  }

  public texturesNextFrame() {
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
    name = Utils.modelName(name)
    const object = objectCache.get(name)
    if (object !== undefined) {
      return object
    }

    let loader: RWXLoader
    switch (loaderType) {
      case 'prop':
        loader = this.rwxPropLoader
        break
      case 'avatar':
        loader = this.rwxAvatarLoader
        break
      default:
        loader = this.basicLoader
        if (loader.path !== this.rwxPath()) {
          // Dirty fix for skybox loading too fast
          loader.setPath(this.rwxPath()).setResourcePath(this.resPath())
        }
    }
    const observable = new Observable<Group>((observer) => {
      loader.load(
        name,
        (rwx: Group) => {
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
