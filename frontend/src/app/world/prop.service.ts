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
    prop: Group
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
   * @param prop
   */
  public parseActions(prop: Group) {
    const result = this.actionParser.parse(prop.userData.act)
    for (const trigger of Object.keys(result)) {
      this.parseAction(prop, trigger, result[trigger])
    }
  }

  /**
   * Called whenever the prop chunk is no longer visible
   * @param prop
   */
  public hideProp(prop: Group) {
    if (prop.userData.light != null) {
      delete prop.userData.light
    }
    if (prop.userData.name != null) {
      delete prop.userData.name
    }
  }

  /**
   * Called on every prop whenever their chunk becomes visible
   * @param prop
   */
  public showProp(prop: Group) {
    this.triggerAction(prop, 'create')
  }

  /**
   * Called once a prop is clicked
   * @param prop
   */
  public clickProp(prop: Group) {
    this.triggerAction(prop, 'activate')
  }

  /**
   * Applies command on prop and remote named props
   * @param prop
   * @param commandArray
   * @param callback
   */
  private applyCommand(prop: Group, commandArray: any[], callback) {
    for (const command of commandArray) {
      if (command.targetName == null) {
        callback(prop, command)
        prop.userData.onUpdate()
      } else {
        Utils.getObjectsByUserData(
          prop.parent.parent.parent,
          'name',
          command.targetName
        ).forEach((child) => {
          callback(child, command)
          child.userData.onUpdate()
        })
      }
    }
  }

  /**
   * Execute commands for the provided trigger
   * @param prop
   * @param trigger
   * @returns
   */
  public triggerAction(
    prop: Group,
    trigger: 'activate' | 'adone' | 'bump' | 'create'
  ) {
    const action = prop.userData[trigger]
    if (action == null) {
      return
    }
    if (action.name != null) {
      prop.userData.name = action.name
    }
    if (action.solid != null) {
      this.applyCommand(prop, action.solid, (target: Group, command) => {
        target.userData.notSolid = !(command.value ?? true)
      })
    }
    if (action.visible != null) {
      this.applyCommand(prop, action.visible, (target: Group, command) => {
        target.userData.notVisible = !(command.value ?? true)
        target.traverse((child: Object3D) => {
          if (child instanceof Mesh) {
            child.material.forEach((m: MeshPhongMaterial, i: number) => {
              // Clone in order to not hide shared materials
              child.material[i] = m.clone()
              // Keep the material from the loader (not serializable)
              child.material[i].userData.rwx.material = m.userData.rwx.material
              child.material[i].visible = !target.userData.notVisible
            })
          }
        })
      })
    }
    if (action.color != null) {
      this.applyCommand(prop, action.color, (target: Group, command) => {
        this.applyTexture(target, null, null, command.color)
      })
    }
    if (action.texture != null) {
      this.applyCommand(prop, action.texture, (target: Group, command) => {
        target.userData.texturing = this.applyTexture(
          target,
          command.texture,
          command.mask
        )
      })
    }
    if (action.picture != null) {
      this.applyCommand(prop, action.picture, (target: Group, command) => {
        if (target.userData.texturing) {
          target.userData.texturing.subscribe(() =>
            this.makePicture(target, command.url)
          )
        } else {
          this.makePicture(target, command.url)
        }
      })
    }
    if (action.sign != null) {
      this.applyCommand(prop, action.sign, (target: Group, command) => {
        if (target.userData.texturing) {
          target.userData.texturing.subscribe(() =>
            this.makeSign(target, command.text, command.color, command.bcolor)
          )
        } else {
          this.makeSign(target, command.text, command.color, command.bcolor)
        }
      })
    }
    if (action.noise != null) {
      this.makeNoise(prop, action.noise.url)
    }
    if (action.sound != null) {
      this.applyCommand(prop, action.sound, (target: Group, command) => {
        target.userData.sound = command.url
      })
    }
    if (action.light != null) {
      this.applyCommand(prop, action.light, (target: Group, command) => {
        target.userData.light = JSON.parse(JSON.stringify(command))
      })
    }
    if (action.corona != null) {
      // Should ALWAYS be checked after light
      this.applyCommand(prop, action.corona, (target: Group, command) => {
        target.userData.corona = JSON.parse(JSON.stringify(command))
        this.makeCorona(target)
      })
    }
    if (action.url != null) {
      this.openUrl(action.url.address)
    }
    if (action.move != null) {
      this.applyCommand(prop, action.move, (target: Group, command) => {
        target.userData.animation = prop.userData.animation || {}
        target.userData.animation.move = JSON.parse(JSON.stringify(command))
        // Reset on show
        target.position.copy(
          new Vector3()
            .add(target.userData.posOrig)
            .sub(target.parent.parent.position)
        )
      })
    }
    if (action.rotate != null) {
      this.applyCommand(prop, action.rotate, (target: Group, command) => {
        target.userData.animation = prop.userData.animation || {}
        target.userData.animation.rotate = JSON.parse(JSON.stringify(command))
        // Reset on show
        target.rotation.copy(target.userData.rotOrig)
      })
    }
  }

  /**
   * Parse every action for the given trigger
   * @param prop The prop to check
   * @param trigger The trigger string (e.g. create)
   * @param commands The parsed object for this trigger
   */
  private parseAction(prop: Group, trigger: string, commands: any) {
    prop.userData[trigger] = {}
    for (const cmd of commands) {
      switch (cmd.commandType) {
        case 'animate':
          prop.userData[trigger].animate = prop.userData[trigger].animate || []
          prop.userData[trigger].animate.push({
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
        case 'astart':
          break
        case 'astop':
          break
        case 'color':
          prop.userData[trigger].color = prop.userData[trigger].color || []
          prop.userData[trigger].color.push({
            color: cmd.color,
            targetName: cmd.targetName
          })
          break
        case 'corona':
          prop.userData[trigger].corona = prop.userData[trigger].corona || []
          prop.userData[trigger].corona.push({
            texture: cmd.resource,
            size: cmd.size,
            targetName: cmd.targetName
          })
          break
        case 'examine':
          prop.userData[trigger].examine = true
          break
        case 'light':
          prop.userData[trigger].light = prop.userData[trigger].light || []
          prop.userData[trigger].light.push({
            color: cmd.color
              ? Utils.rgbToHex(cmd.color.r, cmd.color.g, cmd.color.b)
              : 0xffffff,
            brightness: cmd.brightness,
            radius: cmd.radius,
            fx: cmd.fx,
            targetName: cmd.targetName
          })
          break
        case 'media':
          prop.userData[trigger].media = prop.userData[trigger].media || []
          prop.userData[trigger].media.push({
            url: cmd.url,
            targetName: cmd.targetName
          })
          break
        case 'move':
          prop.userData[trigger].move = prop.userData[trigger].move || []
          prop.userData[trigger].move.push({
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
        case 'name':
          prop.userData[trigger].name = cmd.targetName
          break
        case 'noise':
          prop.userData[trigger].noise = {url: cmd.resource}
          break
        case 'rotate':
          prop.userData[trigger].rotate = prop.userData[trigger].rotate || []
          prop.userData[trigger].rotate.push({
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
        case 'sign':
          prop.userData[trigger].sign = prop.userData[trigger].sign || []
          prop.userData[trigger].sign.push({
            text: cmd.text,
            color: cmd.color,
            bcolor: cmd.bcolor,
            targetName: cmd.targetName
          })
          break
        case 'solid':
          prop.userData[trigger].solid = prop.userData[trigger].solid || []
          prop.userData[trigger].solid.push({
            value: cmd.value,
            targetName: cmd.targetName
          })
          break
        case 'sound':
          prop.userData[trigger].sound = prop.userData[trigger].sound || []
          prop.userData[trigger].sound.push({
            url: cmd.resource,
            targetName: cmd.targetName
          })
          break
        case 'picture':
          prop.userData[trigger].picture = prop.userData[trigger].picture || []
          prop.userData[trigger].picture.push({
            url: cmd.resource,
            targetName: cmd.targetName
          })
          break
        case 'texture':
          prop.userData[trigger].texture = prop.userData[trigger].texture || []
          prop.userData[trigger].texture.push({
            texture:
              cmd.texture != null && cmd.texture.lastIndexOf('.') !== -1
                ? cmd.texture.substring(0, cmd.texture.lastIndexOf('.'))
                : cmd.texture,
            mask:
              cmd.mask != null && cmd.mask.lastIndexOf('.') !== -1
                ? cmd.mask.substring(0, cmd.mask.lastIndexOf('.'))
                : cmd.mask
          })
          break
        case 'url':
          if (['create', 'adone'].indexOf(trigger) === -1) {
            prop.userData[trigger].url = {address: cmd.resource}
          }
          break

        case 'teleport':
          if (['create', 'adone'].indexOf(trigger) === -1) {
            prop.userData[trigger].teleport = {...cmd.coordinates}
            prop.userData[trigger].teleport.worldName = cmd.worldName ?? null
          }
          break
        case 'visible':
          prop.userData[trigger].visible = prop.userData[trigger].visible || []
          prop.userData[trigger].visible.push({
            value: cmd.value,
            targetName: cmd.targetName
          })
          break
        case 'warp':
          prop.userData[trigger].warp = {...cmd.coordinates}
          break
        default:
          break
      }
    }
  }

  /**
   * Try to load a picture to apply
   * @param prop Prop
   * @param url Url string from parsed action
   * @param fallbackArchive If true and no picture is found,
   * try to look for an archived version
   */
  private makePicture(prop: Group, url: string, fallbackArchive = true) {
    let remote = ''
    if (this.remoteUrl.test(url)) {
      remote = url
      url = `${environment.url.mediaProxy}${url}`
    } else {
      url = `${this.resPath()}/${url}`
    }
    this.textureLoader.load(
      url,
      (picture) => this.pictureToProp(prop, picture),
      null,
      () => {
        // Error, usually 404
        if (remote && fallbackArchive && this.settings.get('archivedMedia')) {
          // Send to archive queue
          this.archiveApiQueue.next({prop: prop, url: remote, type: 'picture'})
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
    prop: Group
    url: string
    volume?: number
    type: string
  }) {
    const url = environment.url.mediaArchive
      .replace('$1', data.url)
      .replace(
        '$2',
        new Date(data.prop.userData.date * 1000)
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
              this.makePicture(data.prop, res.url, false)
            }
          })
        )
      case 'noise':
        return this.http.get(url).pipe(
          tap((res: {url?: string}) => {
            if (res?.url != null) {
              // No fallback this time since we're already loading an archived noise
              this.makeNoise(data.prop, res.url, false)
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
              this.makeSound(data.prop, res.url, data.volume, false)
            }
          })
        )
      default:
        return EMPTY
    }
  }

  /**
   * Applies a picture texture to a prop
   * @param prop Prop
   * @param picture Image
   */
  private pictureToProp(prop: Group, picture: Texture) {
    if (!prop.userData.taggedMaterials[PICTURE_TAG]) {
      return
    }

    picture.colorSpace = SRGBColorSpace
    picture.wrapS = RepeatWrapping
    picture.wrapT = RepeatWrapping
    prop.traverse((child: Object3D) => {
      if (child instanceof Mesh) {
        const newMaterials = []
        newMaterials.push(...child.material)
        for (const i of prop.userData.taggedMaterials[PICTURE_TAG]) {
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
    prop: Group,
    text: string,
    color: {r: number; g: number; b: number},
    bcolor: {r: number; g: number; b: number}
  ) {
    if (!prop.userData.taggedMaterials[SIGN_TAG]) {
      return
    }

    if (text == null) {
      text = prop.userData.desc ?? ''
    }
    if (color == null) {
      color = {r: 255, g: 255, b: 255}
    }
    if (bcolor == null) {
      bcolor = {r: 0, g: 0, b: 255}
    }

    prop.traverse((child: Object3D) => {
      if (child instanceof Mesh) {
        const newMaterials = []
        newMaterials.push(...child.material)
        for (const i of prop.userData.taggedMaterials[SIGN_TAG]) {
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
    prop: Group,
    textureName: string = null,
    maskName: string = null,
    color: {r: number; g: number; b: number} = null
  ): Observable<unknown> {
    const promises: Observable<unknown>[] = []
    prop.traverse((child: Object3D) => {
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

  private makeCorona(prop: Group) {
    // Create only once
    if (
      prop.userData.corona.texture == null ||
      prop.userData.coronaObj != null
    ) {
      return
    }

    const textureUrl = `${this.resPath()}/${
      prop.userData.corona.texture
    }${prop.userData.corona.texture.endsWith('.jpg') ? '' : '.jpg'}`
    const size = prop.userData.corona?.size / 100 || 1
    const color = prop.userData.light?.color ?? 0xffffff
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
        prop.userData.boxCenter.x,
        prop.userData.boxCenter.y,
        prop.userData.boxCenter.z
      )
      prop.userData.coronaObj = corona
      prop.add(corona)
    })
  }

  private makeNoise(prop: Group, url: string, fallbackArchive = true) {
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
          this.archiveApiQueue.next({prop, url: remote, type: 'noise'})
        }
      }
    )
  }

  public makeSound(
    prop: Group,
    url: string,
    volume: number,
    fallbackArchive = true
  ) {
    if (this.audioSvc.bgUrl === prop.userData.sound) {
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
    this.audioSvc.bgUrl = prop.userData.sound
    this.audioLoader.load(
      url,
      (sound) => this.audioSvc.playSound(sound, url, volume),
      null,
      () => {
        // Error, usually 404
        if (remote && fallbackArchive && this.settings.get('archivedMedia')) {
          // Send to archive queue
          this.archiveApiQueue.next({prop, url: remote, volume, type: 'sound'})
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
