import {forkJoin, of, Observable, Subject} from 'rxjs'
import {catchError, map} from 'rxjs/operators'
import {computed, effect, Injectable, signal} from '@angular/core'
import {HttpService} from '../network'
import {AWActionParser} from 'aw-action-parser'
import {
  Group,
  Mesh,
  BufferAttribute,
  BufferGeometry,
  LoadingManager,
  MeshBasicMaterial,
  CanvasTexture,
  TextureLoader,
  SRGBColorSpace,
  Color,
  RepeatWrapping,
  Sprite,
  SpriteMaterial
} from 'three'
import type {MeshPhongMaterial, Object3D} from 'three'
import RWXLoader, {
  RWXMaterialManager,
  pictureTag as PICTURE_TAG,
  signTag as SIGN_TAG
} from 'three-rwx-loader'
import * as fflate from 'fflate'
import {config} from '../app.config'
import {Utils} from '../utils'
import {TextCanvas} from '../utils/text-canvas'

// can't be const (angular#25963)
export enum ObjectAct {
  nop = 0,
  forward,
  backward,
  left,
  right,
  up,
  down,
  rotX,
  rotnX,
  rotY,
  rotnY,
  rotZ,
  rotnZ,
  copy,
  delete,
  rotReset,
  snapGrid,
  deselect
}

@Injectable({providedIn: 'root'})
export class ObjectService {
  public objectAction = new Subject<ObjectAct>()
  public path = signal('')
  private rwxPath = computed(() => `${this.path()}/rwx`)
  private resPath = computed(() => `${this.path()}/textures`)
  private unknown: Group
  private rwxPropLoader = new RWXLoader(new LoadingManager())
  private rwxAvatarLoader = new RWXLoader(new LoadingManager())
  private basicLoader = new RWXLoader(new LoadingManager())
  private rwxMaterialManager: RWXMaterialManager
  private actionParser = new AWActionParser()
  private objects: Map<string, Observable<Group>> = new Map()
  private avatars: Map<string, Observable<Group>> = new Map()
  private geomCache: Map<string, BufferGeometry> = new Map()
  private textureLoader = new TextureLoader()
  private remoteUrl = /.+\..+\/.+/g
  private animatedPictures = []

  constructor(private http: HttpService) {
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

  loadAvatars() {
    return this.http.avatars(this.path())
  }

  public execActions(item: Group) {
    let textured = false
    let texturing = null
    const result = this.actionParser.parse(item.userData.act)
    if (result.create != null) {
      for (const cmd of result.create) {
        if (cmd.commandType === 'texture' || cmd.commandType === 'color') {
          textured = true
        }
      }
      for (const cmd of result.create) {
        if (cmd.commandType === 'solid') {
          item.userData.notSolid = !cmd.value
        }
        if (cmd.commandType === 'light') {
          item.userData.light = {
            color: cmd?.color
              ? Utils.rgbToHex(cmd.color.r, cmd.color.g, cmd.color.b)
              : 0xffffff,
            brightness: cmd?.brightness,
            radius: cmd?.radius,
            fx: cmd?.fx
          }
        }
        if (cmd.commandType === 'corona') {
          item.userData.corona = {
            texture: cmd?.resource,
            size: cmd?.size
          }
          if (item.userData.corona.texture != null) {
            const textureUrl = `${this.resPath()}/${
              item.userData.corona.texture
            }${item.userData.corona.texture.endsWith('.jpg') ? '' : '.jpg'}`
            const size = item.userData.corona?.size / 100 || 1
            const color = result.create.find((c) => c.commandType === 'light')
              ?.color || {r: 255, g: 255, b: 255}
            this.textureLoader.load(textureUrl, (texture) => {
              const corona = new Sprite(
                new SpriteMaterial({
                  map: texture,
                  alphaMap: texture,
                  color: Utils.rgbToHex(color.r, color.g, color.b),
                  sizeAttenuation: false,
                  depthTest: false
                })
              )
              corona.name = 'corona'
              corona.visible = false
              corona.scale.set(size, size, size)
              corona.position.set(
                item.userData.boxCenter.x,
                item.userData.boxCenter.y,
                item.userData.boxCenter.z
              )
              item.userData.corona = corona
              item.add(corona)
            })
          }
        }
        if (cmd.commandType === 'visible') {
          item.traverse((child: Object3D) => {
            if (child instanceof Mesh) {
              child.material.forEach((m: MeshPhongMaterial, i: number) => {
                // Clone in order to not hide shared materials
                child.material[i] = m.clone()
                // Keep the material from the loader (not serializable)
                child.material[i].userData.rwx.material =
                  m.userData.rwx.material
                child.material[i].visible = cmd.value
              })
            }
          })
        } else if (cmd.commandType === 'color') {
          this.applyTexture(item, null, null, cmd.color)
        } else if (cmd.commandType === 'texture') {
          if (cmd.texture) {
            cmd.texture =
              cmd.texture.lastIndexOf('.') !== -1
                ? cmd.texture.substring(0, cmd.texture.lastIndexOf('.'))
                : cmd.texture
            if (cmd.mask) {
              cmd.mask =
                cmd.mask.lastIndexOf('.') !== -1
                  ? cmd.mask.substring(0, cmd.mask.lastIndexOf('.'))
                  : cmd.mask
            }
          }
          texturing = this.applyTexture(item, cmd.texture, cmd.mask)
        }
        if (!textured) {
          if (cmd.commandType === 'sign') {
            this.makeSign(item, cmd.text, cmd.color, cmd.bcolor)
          }
          if (cmd.commandType === 'picture') {
            this.makePicture(item, cmd.resource)
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
    if (result.activate != null) {
      for (const cmd of result.activate) {
        item.userData.clickable = true
        if (cmd.commandType === 'teleport') {
          item.userData.teleportClick = {...cmd.coordinates?.[0]}
          item.userData.teleportClick.worldName =
            cmd.worldName != null ? cmd.worldName[0] : null
        }
      }
    }
    if (!textured) {
      return
    }
    if (texturing != null) {
      // there are textures, we wait for them to load
      texturing.subscribe(() => {
        for (const cmd of result.create) {
          if (cmd.commandType === 'sign') {
            this.makeSign(item, cmd.text, cmd.color, cmd.bcolor)
          }
          if (cmd.commandType === 'picture') {
            this.makePicture(item, cmd.resource)
          }
        }
      })
    } else {
      // color, no need to wait
      for (const cmd of result.create) {
        if (cmd.commandType === 'sign') {
          this.makeSign(item, cmd.text, cmd.color, cmd.bcolor)
        }
        if (cmd.commandType === 'picture') {
          this.makePicture(item, cmd.resource)
        }
      }
    }
  }

  makePicture(item: Group, url: string) {
    url = url.match(this.remoteUrl)
      ? `${config.url.imgProxy}${url}`
      : `${this.resPath()}/${url}`
    this.textureLoader.load(url, (picture) => {
      picture.colorSpace = SRGBColorSpace
      picture.wrapS = RepeatWrapping
      picture.wrapT = RepeatWrapping
      item.traverse((child: Object3D) => {
        if (child instanceof Mesh) {
          const newMaterials = []
          newMaterials.push(...child.material)
          if (item.userData.taggedMaterials[PICTURE_TAG]) {
            for (const i of item.userData.taggedMaterials[PICTURE_TAG]) {
              newMaterials[i] = child.material[i].clone()
              newMaterials[i].color = new Color(1, 1, 1)
              newMaterials[i].map = picture
              const {width, height} = picture.image
              if (height > width && height % width === 0) {
                // Animated picture
                const yTiles = height / width
                const yHeight = width / height
                newMaterials[i].userData.rwx.animation = {
                  yTiles,
                  yHeight,
                  step: 0
                }
                picture.offset.y = 1 - yHeight
                picture.repeat.set(1, yHeight)
                this.animatedPictures.push(newMaterials[i])
              }
              newMaterials[i].needsUpdate = true
            }
          }
          child.material = newMaterials
          child.material.needsUpdate = true
        }
      })
    })
  }

  makeSign(
    item: Group,
    text: string,
    color: {r: number; g: number; b: number},
    bcolor: {r: number; g: number; b: number}
  ) {
    if (text == null) {
      text = item.userData.desc != null ? item.userData.desc : ''
    }
    if (color == null) {
      color = {r: 255, g: 255, b: 255}
    }
    if (bcolor == null) {
      bcolor = {r: 0, g: 0, b: 255}
    }

    item.traverse((child: Object3D) => {
      if (child instanceof Mesh) {
        const newMaterials = []
        newMaterials.push(...child.material)
        if (item.userData.taggedMaterials[SIGN_TAG]) {
          for (const i of item.userData.taggedMaterials[SIGN_TAG]) {
            newMaterials[i] = child.material[i].clone()
            newMaterials[i].color = new Color(1, 1, 1)
            newMaterials[i].map = new CanvasTexture(
              TextCanvas.textCanvas(
                text,
                newMaterials[i].userData.ratio,
                color,
                bcolor
              )
            )
            newMaterials[i].map.colorSpace = SRGBColorSpace
          }
        }
        child.material = newMaterials
        child.material.needsUpdate = true
      }
    })
  }

  applyTexture(
    item: Group,
    textureName: string = null,
    maskName: string = null,
    color: {r: number; g: number; b: number} = null
  ): Observable<unknown> {
    const promises: Observable<unknown>[] = []
    item.traverse((child: Object3D) => {
      if (child instanceof Mesh) {
        const newMaterials = []
        child.material.forEach((m: MeshPhongMaterial) => {
          if (m.userData.rwx.material != null) {
            const newRWXMat = m.userData.rwx.material.clone()
            newRWXMat.texture = textureName
            newRWXMat.mask = maskName
            if (color != null) {
              newRWXMat.color = [color.r / 255, color.g / 255, color.b / 255]
            }
            const signature = newRWXMat.getMatSignature()
            if (!this.rwxMaterialManager.hasThreeMaterialPack(signature)) {
              this.rwxMaterialManager.addRWXMaterial(newRWXMat, signature)
            }
            const curMat =
              this.rwxMaterialManager.getThreeMaterialPack(signature)
            newMaterials.push(curMat.threeMat)
            promises.push(forkJoin(curMat.loadingPromises))
          }
          if (m.alphaMap != null) {
            m.alphaMap.dispose()
          }
          if (m.map != null) {
            m.map.dispose()
          }
          m.dispose()
        })
        newMaterials.forEach((m: MeshPhongMaterial) => {
          m.shininess = 0
        })
        child.material = newMaterials
        child.material.needsUpdate = true
      }
    })
    return forkJoin(promises)
  }

  loadProp(name: string, basic = false): Observable<Group> {
    return this.loadObject(name, this.objects, basic ? 'basic' : 'prop')
  }

  loadAvatar(name: string): Observable<Group> {
    return this.loadObject(name, this.avatars, 'avatar')
  }

  cleanCache() {
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

  private loadObject(
    name: string,
    objectCache: Map<string, Observable<Group>>,
    loaderType = 'basic'
  ) {
    name = Utils.modelName(name)
    const object = objectCache.get(name)
    if (object !== undefined) {
      return object
    }
    const loader: RWXLoader =
      loaderType === 'prop'
        ? this.rwxPropLoader
        : loaderType === 'avatar'
        ? this.rwxAvatarLoader
        : this.basicLoader
    if (loader === this.basicLoader && loader.path !== this.rwxPath()) {
      // Dirty fix for skybox loading too fast
      loader.setPath(this.rwxPath()).setResourcePath(this.resPath())
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
        () => observer.next(this.unknown)
      )
    }).pipe(
      map((newObject: Group) => newObject),
      catchError(() => of(this.unknown))
    )
    objectCache.set(name, observable)
    return observable
  }
}
