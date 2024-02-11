import {
  catchError,
  EMPTY,
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
  AudioLoader,
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
  private audioLoader = new AudioLoader()
  private textureLoader = new TextureLoader()
  private remoteUrl = /.+\..+\/.+/
  private animatedPictures = []
  private archiveApiQueue = new Subject<{
    item: Group
    url: string
    type: string
    volume?: number
  }>()
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
          (data) => this.archivedMedia(data).pipe(catchError(() => of())),
          this.maxParallelApiCalls
        )
      )
      .subscribe()
  }

  public loadAvatarList() {
    return this.http.avatars(this.path())
  }

  /**
   * Parses the action string
   * @param item
   */
  public parseActions(item: Group) {
    const result = this.actionParser.parse(item.userData.act)
    for (const trigger of Object.keys(result)) {
      this.parseAction(item, trigger, result[trigger])
    }
  }

  /**
   * Called whenever the prop chunk is no longer visible
   * @param item
   */
  public hideProp(item: Group) {
    if (item.userData.light != null) {
      delete item.userData.light
    }
    if (item.userData.name != null) {
      delete item.userData.name
    }
  }

  /**
   * Called on every prop whenever their chunk becomes visible
   * @param item
   */
  public showProp(item: Group) {
    this.triggerAction(item, 'create')
  }

  /**
   * Called once a prop is clicked
   * @param item
   */
  public clickProp(item: Group) {
    this.triggerAction(item, 'activate')
  }

  /**
   * Execute commands for the provided trigger
   * @param item
   * @param trigger
   * @returns
   */
  public triggerAction(
    item: Group,
    trigger: 'activate' | 'adone' | 'bump' | 'create'
  ) {
    const action = item.userData[trigger]
    if (action == null) {
      return
    }
    if (action.name != null) {
      item.userData.name = action.name
    }
    if (action.visible != null) {
      for (const visible of action.visible) {
        if (visible.targetName == null) {
          item.userData.notVisible = !(visible.value ?? true)
          item.traverse((child: Object3D) => {
            if (child instanceof Mesh) {
              child.material.forEach((m: MeshPhongMaterial, i: number) => {
                // Clone in order to not hide shared materials
                child.material[i] = m.clone()
                // Keep the material from the loader (not serializable)
                child.material[i].userData.rwx.material =
                  m.userData.rwx.material
                child.material[i].visible = !item.userData.notVisible
              })
            }
          })
          item.userData.onUpdate()
        } else {
          Utils.getObjectsByUserData(
            item.parent.parent.parent,
            'name',
            visible.targetName
          ).forEach((prop: Group) => {
            prop.userData.notVisible = !(visible.value ?? true)
            prop.traverse((child: Object3D) => {
              if (child instanceof Mesh) {
                child.material.forEach((m: MeshPhongMaterial, i: number) => {
                  // Clone in order to not hide shared materials
                  child.material[i] = m.clone()
                  // Keep the material from the loader (not serializable)
                  child.material[i].userData.rwx.material =
                    m.userData.rwx.material
                  child.material[i].visible = !prop.userData.notVisible
                })
              }
            })
            prop.userData.onUpdate()
          })
        }
      }
    }
    if (action.color != null) {
      this.applyTexture(item, null, null, action.color)
    }
    if (action.texture != null) {
      item.userData.texturing = this.applyTexture(
        item,
        action.texture.texture,
        action.texture.mask
      )
    }
    if (action.picture != null) {
      if (item.userData.texturing) {
        item.userData.texturing.subscribe(() =>
          this.makePicture(item, action.picture.url)
        )
      } else {
        this.makePicture(item, action.picture.url)
      }
    }
    if (action.sign != null) {
      if (item.userData.texturing) {
        item.userData.texturing.subscribe(() =>
          this.makeSign(
            item,
            action.sign.text,
            action.sign.color,
            action.sign.bcolor
          )
        )
      } else {
        this.makeSign(
          item,
          action.sign.text,
          action.sign.color,
          action.sign.bcolor
        )
      }
    }
    if (action.noise != null) {
      this.makeNoise(item, action.noise.url)
    }
    if (action.sound != null) {
      item.userData.sound = action.sound.url
    }
    if (action.light != null) {
      for (const light of action.light) {
        if (light.targetName == null) {
          item.userData.light = JSON.parse(JSON.stringify(light))
        } else {
          Utils.getObjectsByUserData(
            item.parent.parent.parent,
            'name',
            light.targetName
          ).forEach((prop: Group) => {
            prop.userData.light = JSON.parse(JSON.stringify(light))
            prop.userData.onUpdate()
          })
        }
      }
    }
    if (action.corona != null) {
      // Should ALWAYS be checked after light
      for (const corona of action.corona) {
        if (corona.targetName == null) {
          item.userData.corona = JSON.parse(JSON.stringify(corona))
          this.makeCorona(item)
        } else {
          Utils.getObjectsByUserData(
            item.parent.parent.parent,
            'name',
            corona.targetName
          ).forEach((prop: Group) => {
            prop.userData.corona = JSON.parse(JSON.stringify(corona))
            this.makeCorona(prop)
            prop.userData.onUpdate()
          })
        }
      }
    }
    if (action.url != null) {
      this.openUrl(action.url.address)
    }
    if (action.move != null) {
      for (const move of action.move) {
        if (move.targetName == null) {
          item.userData.animation = item.userData.animation || {}
          item.userData.animation.move = JSON.parse(JSON.stringify(move))
          // Reset on show
          item.position.copy(
            new Vector3()
              .add(item.userData.posOrig)
              .sub(item.parent.parent.position)
          )
        } else {
          Utils.getObjectsByUserData(
            item.parent.parent.parent,
            'name',
            move.targetName
          ).forEach((prop: Group) => {
            prop.userData.animation = prop.userData.animation || {}
            prop.userData.animation.move = JSON.parse(JSON.stringify(move))
            prop.position.copy(
              new Vector3()
                .add(prop.userData.posOrig)
                .sub(prop.parent.parent.position)
            )
            prop.userData.onUpdate()
          })
        }
      }
    }
    if (action.rotate != null) {
      for (const rotate of action.rotate) {
        if (rotate.targetName == null) {
          item.userData.animation = item.userData.animation || {}
          item.userData.animation.rotate = JSON.parse(JSON.stringify(rotate))
          // Reset on show
          item.rotation.copy(item.userData.rotOrig)
        } else {
          Utils.getObjectsByUserData(
            item.parent.parent.parent,
            'name',
            rotate.targetName
          ).forEach((prop: Group) => {
            prop.userData.animation = prop.userData.animation || {}
            prop.userData.animation.rotate = JSON.parse(JSON.stringify(rotate))
            prop.rotation.copy(prop.userData.rotOrig)
            prop.userData.onUpdate()
          })
        }
      }
    }
  }

  /**
   * Parse every action for the given trigger
   * @param item The prop to check
   * @param trigger The trigger string (e.g. create)
   * @param commands The parsed object for this trigger
   */
  private parseAction(item: Group, trigger: string, commands: any) {
    item.userData[trigger] = {}
    for (const cmd of commands) {
      switch (cmd.commandType) {
        case 'animate':
          item.userData[trigger].animate = item.userData[trigger].animate || []
          item.userData[trigger].animate.push({
            mask: cmd.mask,
            tag: cmd.tag,
            targetName: cmd.targetName === 'me' ? null : cmd.targetName,
            animation: cmd.animation,
            imageCount: cmd.imageCount,
            frameCount: cmd.frameCount,
            frameDelay: cmd.frameDelay,
            frameList:
              cmd.frameList ||
              Array.from({length: cmd.imageCount}, (_, i) => i + 1)
          })
          break
        case 'solid':
          item.userData[trigger].notSolid = !cmd.value
          break
        case 'name':
          item.userData[trigger].name = cmd.targetName
          break
        case 'visible':
          item.userData[trigger].visible = item.userData[trigger].visible || []
          item.userData[trigger].visible.push({
            value: cmd.value,
            targetName: cmd.targetName
          })
          break
        case 'color':
          item.userData[trigger].color = cmd.color
          break
        case 'texture':
          item.userData[trigger].texture = {
            texture:
              cmd.texture != null && cmd.texture.lastIndexOf('.') !== -1
                ? cmd.texture.substring(0, cmd.texture.lastIndexOf('.'))
                : cmd.texture,
            mask:
              cmd.mask != null && cmd.mask.lastIndexOf('.') !== -1
                ? cmd.mask.substring(0, cmd.mask.lastIndexOf('.'))
                : cmd.mask
          }
          break
        case 'sign':
          item.userData[trigger].sign = {
            text: cmd.text,
            color: cmd.color,
            bcolor: cmd.bcolor
          }
          break
        case 'picture':
          item.userData[trigger].picture = {url: cmd.resource}
          break
        case 'url':
          if (['create', 'adone'].indexOf(trigger) === -1) {
            item.userData[trigger].url = {address: cmd.resource}
          }
          break
        case 'light':
          item.userData[trigger].light = item.userData[trigger].light || []
          item.userData[trigger].light.push({
            color: cmd.color
              ? Utils.rgbToHex(cmd.color.r, cmd.color.g, cmd.color.b)
              : 0xffffff,
            brightness: cmd.brightness,
            radius: cmd.radius,
            fx: cmd.fx,
            targetName: cmd.targetName
          })
          break
        case 'corona':
          item.userData[trigger].corona = item.userData[trigger].corona || []
          item.userData[trigger].corona.push({
            texture: cmd.resource,
            size: cmd.size,
            targetName: cmd.targetName
          })
          break
        case 'noise':
          item.userData[trigger].noise = {url: cmd.resource}
          break
        case 'sound':
          item.userData[trigger].sound = {url: cmd.resource}
          break
        case 'teleport':
          if (['create', 'adone'].indexOf(trigger) === -1) {
            item.userData[trigger].teleport = {...cmd.coordinates}
            item.userData[trigger].teleport.worldName = cmd.worldName ?? null
          }
          break
        case 'move':
          item.userData[trigger].move = item.userData[trigger].move || []
          item.userData[trigger].move.push({
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
          item.userData[trigger].rotate = item.userData[trigger].rotate || []
          item.userData[trigger].rotate.push({
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
        if (remote && fallbackArchive && this.settings.get('archivedMedia')) {
          // Send to archive queue
          this.archiveApiQueue.next({item, url: remote, type: 'picture'})
        }
      }
    )
  }

  /**
   * Load an archived media from the queue
   * @param data The prop and media url from the queue
   * @returns an observable for the request
   */
  private archivedMedia(data: {
    item: Group
    url: string
    volume?: number
    type: string
  }) {
    const url = environment.url.mediaArchive
      .replace('$1', data.url)
      .replace(
        '$2',
        new Date(data.item.userData.date * 1000)
          .toISOString()
          .substring(0, 10)
          .replaceAll('-', '')
      )
    switch (data.type) {
      case 'picture':
        return this.http.get(url).pipe(
          tap((res: {url?: string}) => {
            if (res?.url != null) {
              // No fallback this time since we're already loading an archived picture
              this.makePicture(data.item, res.url, false)
            }
          })
        )
      case 'noise':
        return this.http.get(url).pipe(
          tap((res: {url?: string}) => {
            if (res?.url != null) {
              // No fallback this time since we're already loading an archived noise
              this.makeNoise(data.item, res.url, false)
            }
          })
        )
      case 'sound':
        return this.http.get(url).pipe(
          tap((res: {url?: string}) => {
            if (res?.url != null) {
              // We reset the bgUrl in order to treat the archive like a new sound
              this.audioSvc.bgUrl = ''
              // No fallback this time since we're already loading an archived sound
              this.makeSound(data.item, res.url, data.volume, false)
            }
          })
        )
      default:
        return EMPTY
    }
  }

  /**
   * Applies a picture texture to a prop
   * @param item Prop
   * @param picture Image
   */
  private pictureToProp(item: Group, picture: Texture) {
    if (!item.userData.taggedMaterials[PICTURE_TAG]) {
      return
    }

    picture.colorSpace = SRGBColorSpace
    picture.wrapS = RepeatWrapping
    picture.wrapT = RepeatWrapping
    item.traverse((child: Object3D) => {
      if (child instanceof Mesh) {
        const newMaterials = []
        newMaterials.push(...child.material)
        for (const i of item.userData.taggedMaterials[PICTURE_TAG]) {
          if (child.material[i].userData.rwx.material != null) {
            newMaterials[i] = child.material[i].clone()
            // Rebuild userData like the loader
            newMaterials[i].userData = {
              collision: child.material[i].userData.collision,
              ratio: child.material[i].userData.ratio,
              rwx: {material: child.material[i].userData.rwx.material.clone()}
            }
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
          if (child.material[i].alphaMap != null) {
            child.material[i].alphaMap.dispose()
          }
          if (child.material[i].map != null) {
            child.material[i].map.dispose()
          }
          child.material[i].dispose()
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
    if (!item.userData.taggedMaterials[SIGN_TAG]) {
      return
    }

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
        for (const i of item.userData.taggedMaterials[SIGN_TAG]) {
          if (child.material[i].userData.rwx.material != null) {
            newMaterials[i] = child.material[i].clone()
            // Rebuild userData like the loader
            newMaterials[i].userData = {
              collision: child.material[i].userData.collision,
              ratio: child.material[i].userData.ratio,
              rwx: {material: child.material[i].userData.rwx.material.clone()}
            }
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
          if (child.material[i].alphaMap != null) {
            child.material[i].alphaMap.dispose()
          }
          if (child.material[i].map != null) {
            child.material[i].map.dispose()
          }
          child.material[i].dispose()
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
            // Rebuild userData like the loader
            newRWXMat.userData = {
              collision: m.userData.collision,
              ratio: m.userData.ratio,
              rwx: {material: m.userData.rwx.material.clone()}
            }
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

  private makeCorona(item: Group) {
    // Create only once
    if (
      item.userData.corona.texture == null ||
      item.userData.coronaObj != null
    ) {
      return
    }

    const textureUrl = `${this.resPath()}/${
      item.userData.corona.texture
    }${item.userData.corona.texture.endsWith('.jpg') ? '' : '.jpg'}`
    const size = item.userData.corona?.size / 100 || 1
    const color = item.userData.light?.color ?? 0xffffff
    this.textureLoader.load(textureUrl, (texture) => {
      texture.colorSpace = SRGBColorSpace
      const corona = new Sprite(
        new SpriteMaterial({
          map: texture,
          alphaMap: texture,
          color: color,
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
      item.userData.coronaObj = corona
      item.add(corona)
    })
  }

  private makeNoise(item: Group, url: string, fallbackArchive = true) {
    let remote = ''
    if (this.remoteUrl.test(url)) {
      remote = url
      url = `${environment.url.mediaProxy}${url}`
    } else {
      url = `${this.audioPath()}/${url}`
    }
    this.audioLoader.load(
      url,
      (noise) => this.audioSvc.playNoise(noise),
      null,
      () => {
        // Error, usually 404
        if (remote && fallbackArchive && this.settings.get('archivedMedia')) {
          // Send to archive queue
          this.archiveApiQueue.next({item, url: remote, type: 'noise'})
        }
      }
    )
  }

  public makeSound(
    item: Group,
    url: string,
    volume: number,
    fallbackArchive = true
  ) {
    if (this.audioSvc.bgUrl === item.userData.sound) {
      // Sound didn't change, don't load it again
      this.audioSvc.setSoundVolume(volume)
      return
    }
    let remote = ''
    if (this.remoteUrl.test(url)) {
      remote = url
      url = `${environment.url.mediaProxy}${url}`
    } else {
      url = `${this.audioPath()}/${url}`
    }
    // This sound might not be working, but we still store it to keep track of it
    this.audioSvc.bgUrl = item.userData.sound
    this.audioLoader.load(
      url,
      (sound) => this.audioSvc.playSound(sound, url, volume),
      null,
      () => {
        // Error, usually 404
        if (remote && fallbackArchive && this.settings.get('archivedMedia')) {
          // Send to archive queue
          this.archiveApiQueue.next({item, url: remote, volume, type: 'sound'})
        }
      }
    )
  }

  private openUrl(url: string) {
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
