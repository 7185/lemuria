import {
  catchError,
  forkJoin,
  mergeMap,
  Observable,
  of,
  Subject,
  tap
} from 'rxjs'
import {computed, effect, inject, Injectable, signal} from '@angular/core'
import {HttpService} from '../network'
import {Action} from '@lemuria/action-parser'
import {
  AdditiveBlending,
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
  SpriteMaterial,
  Vector3
} from 'three'
import type {MeshPhongMaterial, Object3D, Texture} from 'three'
import RWXLoader, {
  RWXMaterialManager,
  pictureTag as PICTURE_TAG,
  signTag as SIGN_TAG
} from 'three-rwx-loader'
import * as fflate from 'fflate'
import {environment} from '../../environments/environment'
import {TextCanvas, Utils} from '../utils'
import {SettingsService} from '../settings/settings.service'
import {TeleportService} from '../engine/teleport.service'
import {AudioService} from '../engine/audio.service'

const propActs = [
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
export type PropAct = (typeof propActs)[number]

@Injectable({providedIn: 'root'})
export class PropService {
  public propAction = new Subject<PropAct>()
  public path = signal('')
  private rwxPath = computed(() => `${this.path()}/rwx`)
  private resPath = computed(() => `${this.path()}/textures`)
  private audioPath = computed(() => `${this.path()}/sounds`)
  private unknown: Group
  private rwxPropLoader = new RWXLoader(new LoadingManager())
  private rwxAvatarLoader = new RWXLoader(new LoadingManager())
  private basicLoader = new RWXLoader(new LoadingManager())
  private rwxMaterialManager: RWXMaterialManager
  private actionParser = new Action()
  private objects: Map<string, Observable<Group>> = new Map()
  private avatars: Map<string, Observable<Group>> = new Map()
  private geomCache: Map<string, BufferGeometry> = new Map()
  private textureLoader = new TextureLoader()
  private remoteUrl = /.+\..+\/.+/
  private animatedPictures = []
  private archiveApiQueue = new Subject<{item: Group; url: string}>()
  private maxParallelApiCalls = 3
  private http = inject(HttpService)
  private settings = inject(SettingsService)
  private teleportSvc = inject(TeleportService)
  private audioSvc = inject(AudioService)

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

    this.archiveApiQueue
      .asObservable()
      .pipe(
        mergeMap(
          (data) => this.archivedPicture(data).pipe(catchError(() => of())),
          this.maxParallelApiCalls
        )
      )
      .subscribe()
  }

  public loadAvatarList() {
    return this.http.avatars(this.path())
  }

  public parseActions(item: Group) {
    const result = this.actionParser.parse(item.userData.act)
    if (result.create != null) {
      this.parseCreate(item, result)
    }
    if (result.activate != null) {
      this.parseActivate(item, result)
    }
  }

  /**
   * Called on every prop whenever their chunk becomes visible
   */
  public showProp(item: Group) {
    if (item.userData.create?.notVisible) {
      item.traverse((child: Object3D) => {
        if (child instanceof Mesh) {
          child.material.forEach((m: MeshPhongMaterial, i: number) => {
            // Clone in order to not hide shared materials
            child.material[i] = m.clone()
            // Keep the material from the loader (not serializable)
            child.material[i].userData.rwx.material = m.userData.rwx.material
            child.material[i].visible = false
          })
        }
      })
    }
    if (item.userData.create?.noise) {
      this.makeNoise(item.userData.create.noise)
    }
  }

  private parseCreate(item: Group, result: any) {
    const textured = result.create.some(
      (cmd) => cmd.commandType === 'texture' || cmd.commandType === 'color'
    )
    let texturing = null
    item.userData.create = {}
    for (const cmd of result.create) {
      switch (cmd.commandType) {
        case 'solid':
          item.userData.create.notSolid = !cmd.value
          break
        case 'name':
          item.userData.name = cmd.targetName
          break
        case 'noise':
          item.userData.create.noise = cmd.resource
          break
        case 'sound':
          item.userData.create.sound = cmd.resource
          break
        case 'light':
          item.userData.create.light = {
            color: cmd?.color
              ? Utils.rgbToHex(cmd.color.r, cmd.color.g, cmd.color.b)
              : 0xffffff,
            brightness: cmd?.brightness,
            radius: cmd?.radius,
            fx: cmd?.fx
          }
          break
        case 'corona':
          item.userData.create.corona = {
            texture: cmd?.resource,
            size: cmd?.size
          }
          if (item.userData.create.corona.texture != null) {
            const textureUrl = `${this.resPath()}/${
              item.userData.create.corona.texture
            }${
              item.userData.create.corona.texture.endsWith('.jpg') ? '' : '.jpg'
            }`
            const size = item.userData.create.corona?.size / 100 || 1
            const color = result.create.find((c) => c.commandType === 'light')
              ?.color || {r: 255, g: 255, b: 255}
            this.textureLoader.load(textureUrl, (texture) => {
              texture.colorSpace = SRGBColorSpace
              const corona = new Sprite(
                new SpriteMaterial({
                  map: texture,
                  alphaMap: texture,
                  color: Utils.rgbToHex(color.r, color.g, color.b),
                  blending: AdditiveBlending,
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
              item.userData.create.corona = corona
              item.add(corona)
            })
          }
          break
        case 'visible':
          item.userData.create.notVisible = !cmd.value
          break
        case 'color':
          this.applyTexture(item, null, null, cmd.color)
          break
        case 'texture':
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
          break
        case 'sign':
          if (!textured) {
            this.makeSign(item, cmd.text, cmd.color, cmd.bcolor)
          }
          break
        case 'picture':
          if (!textured) {
            this.makePicture(item, cmd.resource)
          }
          break
        case 'move':
          if (item.userData.animation == null) {
            item.userData.animation = {}
          }
          item.userData.create.move = {
            distance: cmd.distance,
            time: cmd.time || 1,
            loop: cmd.loop || false,
            reset: cmd.reset || false,
            wait: cmd.wait || 0,
            waiting: 0,
            completion: 0,
            direction: 1,
            targetName: cmd.targetName
          }
          if (cmd.targetName == null) {
            item.userData.animation.move = JSON.parse(
              JSON.stringify(item.userData.create.move)
            )
          }
          break
        case 'rotate':
          if (item.userData.animation == null) {
            item.userData.animation = {}
          }
          item.userData.create.rotate = {
            speed: cmd.speed,
            time: cmd.time || null,
            loop: cmd.loop || false,
            reset: cmd.reset || false,
            wait: cmd.wait || 0,
            waiting: 0,
            completion: 0,
            direction: 1,
            targetName: cmd.targetName
          }
          if (cmd.targetName == null) {
            item.userData.animation.rotate = JSON.parse(
              JSON.stringify(item.userData.create.rotate)
            )
          }
          break
        default:
          break
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

  private parseActivate(item: Group, result: any) {
    item.userData.activate = {}
    for (const cmd of result.activate) {
      switch (cmd.commandType) {
        case 'teleport':
          item.userData.activate.teleport = {...cmd.coordinates}
          item.userData.activate.teleport.worldName = cmd.worldName ?? null
          break
        case 'url':
          item.userData.activate.url = {address: cmd.resource}
          break
        case 'noise':
          item.userData.activate.noise = {url: cmd.resource}
          break
        case 'sound':
          item.userData.activate.sound = {url: cmd.resource}
          break
        case 'move':
          item.userData.activate.move = item.userData.activate.move || []
          item.userData.activate.move.push({
            distance: cmd.distance,
            time: cmd.time || 1,
            loop: cmd.loop || false,
            reset: cmd.reset || false,
            wait: cmd.wait || 0,
            waiting: 0,
            completion: 0,
            direction: 1,
            targetName: cmd.targetName
          })
          break
        case 'rotate':
          item.userData.activate.rotate = item.userData.activate.rotate || []
          item.userData.activate.rotate.push({
            speed: cmd.speed,
            time: cmd.time || null,
            loop: cmd.loop || false,
            reset: cmd.reset || false,
            wait: cmd.wait || 0,
            waiting: 0,
            completion: 0,
            direction: 1,
            targetName: cmd.targetName
          })
          break
        default:
          break
      }
    }
  }

  /**
   * Try to load a picture to apply
   * @param item Prop
   * @param url Url string from parsed action
   * @param fallbackArchive If true and no picture is found,
   * try to look for an archived version
   */
  private makePicture(item: Group, url: string, fallbackArchive = true) {
    let remote = ''
    if (this.remoteUrl.test(url)) {
      remote = url
      url = `${environment.url.mediaProxy}${url}`
    } else {
      url = `${this.resPath()}/${url}`
    }
    this.textureLoader.load(
      url,
      (picture) => this.pictureToProp(item, picture),
      null,
      () => {
        // Error, usually 404
        if (
          remote &&
          fallbackArchive &&
          this.settings.get('archivedPictures')
        ) {
          // Send to archive queue
          this.archiveApiQueue.next({item, url: remote})
        }
      }
    )
  }

  /**
   * Load an archived image from the queue
   * @param data The prop and image url from the queue
   * @returns an observable for the request
   */
  private archivedPicture(data: {item: Group; url: string}) {
    const url = environment.url.imgArchive
      .replace('$1', data.url)
      .replace(
        '$2',
        new Date(data.item.userData.date * 1000)
          .toISOString()
          .substring(0, 10)
          .replaceAll('-', '')
      )
    return this.http.get(url).pipe(
      tap((res: {url?: string}) => {
        if (res?.url != null) {
          // No fallback this time since we're already loading an archived picture
          this.makePicture(data.item, res.url, false)
        }
      })
    )
  }

  /**
   * Applies a picture texture to a prop
   * @param item Prop
   * @param picture Image
   */
  private pictureToProp(item: Group, picture: Texture) {
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
  }

  private makeSign(
    item: Group,
    text: string,
    color: {r: number; g: number; b: number},
    bcolor: {r: number; g: number; b: number}
  ) {
    if (text == null) {
      text = item.userData.desc ?? ''
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
                color,
                bcolor,
                newMaterials[i].userData.ratio
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

  private applyTexture(
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

  public makeNoise(url: string) {
    if (this.remoteUrl.test(url)) {
      url = `${environment.url.mediaProxy}${url}`
    } else {
      url = `${this.audioPath()}/${url}`
    }
    this.audioSvc.playNoise(url)
  }

  public openUrl(url: string) {
    Object.assign(document.createElement('a'), {
      target: '_blank',
      rel: 'noopener noreferrer',
      href: url
    }).click()
  }

  /**
   * Teleport the player according to the teleport data
   * @param teleport Parsed teleport data
   * @param playerPosition Current player position
   * @param playerYaw Current player yaw
   * @returns
   */
  public teleportPlayer(
    teleport: {
      type?: string
      worldName?: string
      direction?: number
      altitude?: number
      ew?: number
      ns?: number
      x?: number
      y?: number
    },
    playerPosition: Vector3,
    playerYaw: number
  ) {
    if (teleport.type == null) {
      // No coords, send user to world entry point
      this.teleportSvc.teleport.set({
        world: teleport.worldName,
        position: null,
        isNew: true
      })
      return
    }

    let newX: number, newZ: number
    let newY = 0
    let newYaw = teleport?.direction || 0

    if (teleport.altitude != null) {
      if (teleport.type === 'absolute') {
        newY = teleport.altitude * 10
      } else {
        newY = playerPosition.y + teleport.altitude * 10
      }
    }
    if (teleport.type === 'absolute') {
      newX = teleport.ew * -10
      newZ = teleport.ns * 10
    } else {
      newYaw += playerYaw
      newX = playerPosition.x + teleport.x * -10
      newZ = playerPosition.z + teleport.y * 10
    }
    this.teleportSvc.teleport.set({
      world: teleport.worldName,
      // Don't send 0 if coordinates are null (world entry point)
      position: Utils.posToString(new Vector3(newX, newY, newZ), newYaw),
      isNew: true
    })
  }

  public loadProp(name: string, basic = false): Observable<Group> {
    return this.loadObject(name, this.objects, basic ? 'basic' : 'prop')
  }

  public loadAvatar(name: string): Observable<Group> {
    return this.loadObject(name, this.avatars, 'avatar')
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
