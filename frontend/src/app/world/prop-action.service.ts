import {inject, Injectable} from '@angular/core'
import {
  catchError,
  EMPTY,
  forkJoin,
  interval,
  mergeMap,
  of,
  Subject,
  take,
  tap
} from 'rxjs'
import type {Observable} from 'rxjs'
import {
  AdditiveBlending,
  AudioLoader,
  CanvasTexture,
  Color,
  Group,
  ImageBitmapLoader,
  Mesh,
  RepeatWrapping,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace
} from 'three'
import type {MeshPhongMaterial, Object3D, Vector3} from 'three'
import {pictureTag as PICTURE_TAG, signTag as SIGN_TAG} from 'three-rwx-loader'
import {environment} from '../../environments/environment'
import {HttpService} from '../network'
import {getObjectsByUserData, posToStringYaw, rgbToHex} from '../utils/utils'
import {SettingsService} from '../settings/settings.service'
import {AudioService} from '../engine/audio.service'
import {TeleportService} from '../engine/teleport.service'
import {WorkerService} from '../worker/worker.service'
import {PropService} from './prop.service'

@Injectable({providedIn: 'root'})
export class PropActionService {
  private audioLoader = new AudioLoader()
  private textureLoader = new ImageBitmapLoader().setOptions({
    imageOrientation: 'flipY'
  })
  private remoteUrl = /.+\..+\/.+/
  private readonly teleportSvc = inject(TeleportService)
  private readonly settings = inject(SettingsService)
  private readonly audioSvc = inject(AudioService)
  private readonly propSvc = inject(PropService)
  private readonly http = inject(HttpService)
  private readonly workerSvc = inject(WorkerService)
  private archiveApiQueue = new Subject<{
    prop: Group
    url: string
    type: string
    volume?: number
  }>()
  private maxParallelApiCalls = 3

  constructor() {
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

  /**
   * Called whenever the prop chunk is no longer visible
   * @param prop
   */
  hideProp(prop: Group) {
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
  showProp(prop: Group) {
    this.triggerAction(prop, 'create')
  }

  /**
   * Called once a prop is clicked
   * @param prop
   */
  clickProp(prop: Group) {
    this.triggerAction(prop, 'activate')
  }

  async parseActions(prop: Group) {
    try {
      const parsedActions = await this.workerSvc.parseAction(prop.userData.act)
      Object.entries(parsedActions).forEach(([trigger, action]) =>
        this.parseAction(prop, trigger, action)
      )
    } catch (error) {
      console.error('Error parsing actions:', error)
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
            frameList: cmd.frameList.length
              ? cmd.frameList
              : Array.from({length: cmd.imageCount}, (_, i) => i + 1)
          })
          break
        case 'astart':
          prop.userData[trigger].astart = prop.userData[trigger].astart || []
          prop.userData[trigger].astart.push({
            loop: cmd.loop ?? false,
            targetName: cmd.targetName
          })
          break
        case 'astop':
          prop.userData[trigger].astop = prop.userData[trigger].astop || []
          prop.userData[trigger].astop.push({
            targetName: cmd.targetName
          })
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
              ? rgbToHex(cmd.color.r, cmd.color.g, cmd.color.b)
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
                : cmd.mask,
            tag: cmd.tag,
            targetName: cmd.targetName
          })
          break
        case 'url':
          if (!['create', 'adone'].includes(trigger)) {
            prop.userData[trigger].url = {address: cmd.resource}
          }
          break

        case 'teleport':
          if (!['create', 'adone'].includes(trigger)) {
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
   * Applies command on prop and remote named props
   * @param prop
   * @param commandArray
   * @param callback
   */
  private applyCommand(
    prop: Group,
    commandArray: any[],
    callback: CallableFunction
  ) {
    for (const command of commandArray) {
      if (command.targetName == null) {
        callback(prop, command)
        prop.userData.onUpdate()
      } else {
        getObjectsByUserData(
          prop.parent!.parent!.parent!,
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
  triggerAction(
    prop: Group,
    trigger: 'activate' | 'adone' | 'bump' | 'create'
  ) {
    const action = prop.userData[trigger]
    // A prop with no parent means it's being deleted
    if (action == null || prop.parent == null) {
      return
    }
    if (action.name != null) {
      prop.userData.name = action.name
    }
    if (action.animate != null) {
      this.applyCommand(prop, action.animate, (target: Group, command) => {
        target.userData.animate = JSON.parse(JSON.stringify(command))
      })
    }
    if (action.astart != null) {
      this.applyCommand(prop, action.astart, (target: Group, command) => {
        this.animateStart(target, command.loop)
      })
    }
    if (action.astop != null) {
      this.applyCommand(prop, action.astop, (target: Group, _: unknown) => {
        this.animateStop(target)
      })
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
        this.applyTexture(target, null, null, null, command.color)
      })
    }
    if (action.texture != null) {
      this.applyCommand(prop, action.texture, (target: Group, command) => {
        target.userData.texturing = this.applyTexture(
          target,
          command.texture,
          command.mask,
          command.tag
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
        target.position
          .copy(target.userData.posOrig)
          .sub(target.parent.parent.position)
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

  private animateStart(prop: Group, loop = false) {
    if (prop.userData.animate == null) {
      return
    }
    prop.userData.animateSub?.unsubscribe()
    prop.userData.animateSub = interval(prop.userData.animate.frameDelay)
      .pipe(
        take(prop.userData.animate.frameList.length),
        tap({
          complete: () => {
            if (!loop) {
              prop.userData.animateSub.unsubscribe()
              this.triggerAction(prop, 'adone')
            }
          }
        })
      )
      .subscribe((frameId) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const animation = `${prop.userData.animate.animation}${frameId}`
        // Doesn't apply to all objects
        // Shouldn't do anything if the texture is not found
        // this.applyTexture(prop, animation, prop.userData.animate.mask ? `${animation}m` : null)
      })
  }

  private animateStop(prop: Group) {
    if (prop.userData.animate == null) {
      return
    }
    prop.userData.animateSub?.unsubscribe()
  }

  /**
   * Try to load a picture to apply
   * @param prop Prop
   * @param url Url string from parsed action
   * @param fallbackArchive If true and no picture is found,
   * try to look for an archived version
   */
  private makePicture(prop: Group, url: string, fallbackArchive = true) {
    if (!this.hasTaggedMaterial(prop, PICTURE_TAG)) {
      return
    }
    let remote = ''
    if (this.remoteUrl.test(url)) {
      remote = url
      url = `${environment.url.mediaProxy}${url}`
    } else {
      url = `${this.propSvc.resPath()}/${url}`
    }
    this.textureLoader.load(
      url,
      (picture) => this.pictureToProp(prop, picture),
      null,
      () => {
        // Error, usually 404
        if (remote && fallbackArchive && this.settings.get('archivedMedia')) {
          // Send to archive queue
          this.archiveApiQueue.next({
            prop: prop,
            url: remote,
            type: 'picture'
          })
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
  private pictureToProp(prop: Group, bitmap: ImageBitmap) {
    const picture = new CanvasTexture(bitmap)
    picture.colorSpace = SRGBColorSpace
    picture.wrapS = picture.wrapT = RepeatWrapping
    prop.traverse((child: Object3D) => {
      if (
        child instanceof Mesh &&
        Object.keys(child.userData.taggedMaterials).length
      ) {
        const newMaterials = []
        newMaterials.push(...child.material)
        for (const i of child.userData.taggedMaterials[PICTURE_TAG]) {
          if (child.material[i].userData.rwx?.material != null) {
            newMaterials[i] = child.material[i].clone()
            // Rebuild userData like the loader
            newMaterials[i].userData = {
              collision: child.material[i].userData.collision,
              ratio: child.material[i].userData.ratio,
              rwx: {
                material: child.material[i].userData.rwx.material
              }
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
              this.propSvc.animatedPictures.push(newMaterials[i])
            }
            newMaterials[i].needsUpdate = true
          }
          child.material[i].alphaMap?.dispose()
          child.material[i].map?.dispose()
          child.material[i].dispose()
        }
        newMaterials.forEach((m: MeshPhongMaterial) => {
          m.visible = !prop.userData.notVisible
        })
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
    if (!this.hasTaggedMaterial(prop, SIGN_TAG)) {
      return
    }

    text ??= prop.userData.desc ?? ''
    color ??= {r: 255, g: 255, b: 255}
    bcolor ??= {r: 0, g: 0, b: 255}

    prop.traverse(async (child: Object3D) => {
      if (
        child instanceof Mesh &&
        Object.keys(child.userData.taggedMaterials).length
      ) {
        const newMaterials = []
        newMaterials.push(...child.material)
        for (const i of child.userData.taggedMaterials[SIGN_TAG]) {
          if (child.material[i].userData.rwx?.material != null) {
            newMaterials[i] = child.material[i].clone()
            // Rebuild userData like the loader
            newMaterials[i].userData = {
              collision: child.material[i].userData.collision,
              ratio: child.material[i].userData.ratio,
              rwx: {
                material: child.material[i].userData.rwx.material
              }
            }
            try {
              const bitmap = await this.workerSvc.textCanvas(
                text,
                color,
                bcolor,
                newMaterials[i].userData.ratio
              )
              newMaterials[i].color = new Color(1, 1, 1)
              newMaterials[i].map = new CanvasTexture(bitmap)
              newMaterials[i].map.colorSpace = SRGBColorSpace
            } catch (error) {
              console.error('Error in textCanvas:', error)
            }
          }
          child.material[i].alphaMap?.dispose()
          child.material[i].map?.dispose()
          child.material[i].dispose()
        }
        newMaterials.forEach((m: MeshPhongMaterial) => {
          m.visible = !prop.userData.notVisible
        })
        child.material = newMaterials
        child.material.needsUpdate = true
      }
    })
  }

  private applyTexture(
    prop: Group,
    textureName: string | null = null,
    maskName: string | null = null,
    tag: string | null = null,
    color: {r: number; g: number; b: number} | null = null
  ): Observable<unknown> {
    const promises: Observable<unknown>[] = []
    let currentTag = null
    prop.traverse((child: Object3D) => {
      if (tag && child instanceof Group) {
        currentTag = child.parent.userData.rwx?.tag
      }
      if (child instanceof Mesh) {
        if (tag && currentTag !== +tag) {
          return
        }
        const newMaterials = []
        child.material.forEach((m: MeshPhongMaterial) => {
          if (m.userData.rwx?.material != null) {
            const newRWXMat = m.userData.rwx?.material.clone()
            // Rebuild userData like the loader
            newRWXMat.userData = {
              collision: m.userData.collision,
              ratio: m.userData.ratio,
              rwx: {material: m.userData.rwx.material}
            }
            newRWXMat.texture = textureName
            newRWXMat.mask = maskName
            if (color != null) {
              newRWXMat.color = [color.r / 255, color.g / 255, color.b / 255]
            }
            const signature = newRWXMat.getMatSignature()
            if (
              !this.propSvc.rwxMaterialManager.hasThreeMaterialPack(signature)
            ) {
              this.propSvc.rwxMaterialManager.addRWXMaterial(
                newRWXMat,
                signature
              )
            }
            const curMat =
              this.propSvc.rwxMaterialManager.getThreeMaterialPack(signature)
            newMaterials.push(curMat.threeMat)
            promises.push(forkJoin(curMat.loadingPromises))
          }
          m.alphaMap?.dispose()
          m.map?.dispose()
          m.dispose()
        })
        newMaterials.forEach((m: MeshPhongMaterial) => {
          m.visible = !prop.userData.notVisible
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

    const textureUrl = `${this.propSvc.resPath()}/${prop.userData.corona.texture}${
      prop.userData.corona.texture.endsWith('.jpg') ? '' : '.jpg'
    }`
    const size = prop.userData.corona?.size / 100 || 1
    const color = prop.userData.light?.color ?? 0xffffff
    this.textureLoader.load(textureUrl, (bitmap) => {
      const texture = new CanvasTexture(bitmap)
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
      url = `${this.propSvc.audioPath()}/${url}`
    }
    this.audioLoader.load(
      url,
      (noise) => this.audioSvc.playNoise(noise),
      null,
      () => {
        // Error, usually 404
        if (remote && fallbackArchive && this.settings.get('archivedMedia')) {
          // Send to archive queue
          this.archiveApiQueue.next({
            prop,
            url: remote,
            type: 'noise'
          })
        }
      }
    )
  }

  makeSound(prop: Group, url: string, volume: number, fallbackArchive = true) {
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
      url = `${this.propSvc.audioPath()}/${url}`
    }
    // This sound might not be working, but we still store it to keep track of it
    this.audioSvc.bgUrl = prop.userData.sound
    this.audioLoader.load(
      url,
      (sound) => this.audioSvc.playSound(sound, volume),
      null,
      () => {
        // Error, usually 404
        if (remote && fallbackArchive && this.settings.get('archivedMedia')) {
          // Send to archive queue
          this.archiveApiQueue.next({
            prop,
            url: remote,
            volume,
            type: 'sound'
          })
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

  private hasTaggedMaterial(prop: Group, tag: string) {
    let hasTag = false
    prop.traverse((child: Object3D) => {
      if (child instanceof Mesh && child.userData.taggedMaterials[tag]) {
        hasTag = true
      }
    })
    return hasTag
  }

  /**
   * Teleport the player according to the teleport data
   * @param teleport Parsed teleport data
   * @param playerPosition Current player position
   * @param playerYaw Current player yaw
   * @returns
   */
  teleportPlayer(
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
      position: posToStringYaw({x: newX, y: newY, z: newZ}, newYaw),
      isNew: true
    })
  }
}
