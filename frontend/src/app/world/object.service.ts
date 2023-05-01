import {forkJoin, of, BehaviorSubject, Observable, Subject} from 'rxjs'
import {catchError, map} from 'rxjs/operators'
import {Injectable} from '@angular/core'
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
  Color
} from 'three'
import type {MeshPhongMaterial, Object3D} from 'three'
import RWXLoader, {
  RWXMaterialManager,
  pictureTag,
  signTag
} from 'three-rwx-loader'
import * as fflate from 'fflate'
import {config} from '../app.config'
import {Utils} from '../utils'

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
  public path = new BehaviorSubject('http://localhost')
  private unknown: Group
  private rwxPropLoader = new RWXLoader(new LoadingManager())
  private rwxAvatarLoader = new RWXLoader(new LoadingManager())
  private basicLoader = new RWXLoader(new LoadingManager())
  private rwxMaterialManager: RWXMaterialManager
  private actionParser = new AWActionParser()
  private objects: Map<string, Observable<any>> = new Map()
  private avatars: Map<string, Observable<any>> = new Map()
  private pictureLoader = new TextureLoader()
  private remoteUrl = /.+\..+\/.+/g

  constructor(private http: HttpService) {
    const unknownGeometry = new BufferGeometry()
    const positions = [-0.2, 0.0, 0.0, 0.2, 0.0, 0.0, 0.0, 0.2, 0.0]
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
      this.path.value,
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
    this.path.subscribe((url) => {
      this.rwxMaterialManager.folder = `${url}/textures`
      this.rwxPropLoader
        .setPath(`${url}/rwx`)
        .setResourcePath(`${url}/textures`)
      this.rwxAvatarLoader
        .setPath(`${url}/rwx`)
        .setResourcePath(`${url}/textures`)
      this.basicLoader.setPath(`${url}/rwx`).setResourcePath(`${url}/textures`)
    })
  }

  loadAvatars() {
    return this.http.avatars(this.path.value)
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
        if (cmd.commandType === 'visible') {
          item.visible = cmd.value
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
          item.userData.teleportClick = {}
          Object.assign(item.userData.teleportClick, cmd.coordinates[0])
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
      : `${this.path.value}/textures/${url}`
    this.pictureLoader.load(url, (image) => {
      ;(image as any).colorSpace = SRGBColorSpace
      item.traverse((child: Object3D) => {
        if (child instanceof Mesh) {
          const newMaterials = []
          newMaterials.push(...child.material)
          if (item.userData.taggedMaterials[pictureTag]) {
            for (const i of item.userData.taggedMaterials[pictureTag]) {
              newMaterials[i] = child.material[i].clone()
              newMaterials[i].color = new Color(1, 1, 1)
              newMaterials[i].map = image
              newMaterials[i].needsUpdate = true
            }
          }
          child.material = newMaterials
          child.material.needsUpdate = true
        }
      })
    })
  }

  textCanvas(
    text: string,
    ratio = 1,
    color: {r: number; g: number; b: number},
    bcolor: {r: number; g: number; b: number}
  ) {
    const canvas = document.createElement('canvas')
    canvas.width = ratio > 1 ? 256 : 256 * ratio
    canvas.height = ratio > 1 ? 256 / ratio : 256
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = `rgb(${bcolor.r},${bcolor.g},${bcolor.b})`
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = `rgb(${color.r},${color.g},${color.b})`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    const fontSizes = [120, 50, 40, 30, 20, 10, 5]
    let fontIndex = 0

    const words = text.split(/([ \n])/)
    let lines = ['']
    const maxWidth = canvas.width * 0.95
    const maxHeight = (canvas.height * 0.95) / ratio

    ctx.font = `${fontSizes[fontIndex]}px Arial`

    // TODO: use a proper way to get line height from font size
    const fontSizeToHeightRatio = 1
    let lineHeight = fontSizes[fontIndex] * fontSizeToHeightRatio

    let curWordIndex = 0

    let tentativeWord: string
    let tentativeLine: string

    while (curWordIndex < words.length) {
      const curLine = lines.length - 1

      if (words[curWordIndex] === '\n') {
        tentativeWord = ''
      } else {
        tentativeWord = words[curWordIndex]
      }

      if (lines[curLine].length > 0) {
        tentativeLine = lines[curLine] + tentativeWord
      } else {
        tentativeLine = tentativeWord
      }

      if (
        words[curWordIndex] !== '\n' &&
        ctx.measureText(tentativeLine).width <= maxWidth
      ) {
        // TODO: use actualBoundingBoxLeft and actualBoundingBoxRight instead of .width
        // Adding word to end of line
        lines[curLine] = tentativeLine
        curWordIndex += 1
      } else if (
        ctx.measureText(tentativeWord).width <= maxWidth &&
        lineHeight * (curLine + 1) <= maxHeight
      ) {
        // Adding word as a new line
        lines.push(tentativeWord)
        curWordIndex += 1
      } else if (fontIndex < fontSizes.length - 1) {
        // Retry all with smaller font size
        fontIndex += 1
        ctx.font = `${fontSizes[fontIndex]}px Arial`
        lineHeight = fontSizes[fontIndex] * fontSizeToHeightRatio
        lines = ['']
        curWordIndex = 0
      } else {
        // Min font size reached, add word as new line anyway
        lines.push(tentativeWord)
        curWordIndex += 1
      }
    }

    lines.forEach((line: string, i: number) => {
      ctx.fillText(
        line,
        canvas.width / 2,
        canvas.height / 2 +
          i * lineHeight -
          ((lines.length - 1) * lineHeight) / 2
      )
    })

    return canvas
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
        if (item.userData.taggedMaterials[signTag]) {
          for (const i of item.userData.taggedMaterials[signTag]) {
            newMaterials[i] = child.material[i].clone()
            newMaterials[i].color = new Color(1, 1, 1)
            newMaterials[i].map = new CanvasTexture(
              this.textCanvas(
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
    color: any = null
  ): Observable<any> {
    const promises: Observable<any>[] = []
    item.traverse((child: Object3D) => {
      if (child instanceof Mesh) {
        const newMaterials = []
        child.material.forEach((m: MeshPhongMaterial) => {
          if (m.userData.rwx.material != null) {
            const newRWXMat = m.userData.rwx.material.clone()
            newRWXMat.texture = textureName
            newRWXMat.mask = maskName
            if (color != null) {
              newRWXMat.color = [
                color.r / 255.0,
                color.g / 255.0,
                color.b / 255.0
              ]
            }
            const signature = newRWXMat.getMatSignature()
            this.rwxMaterialManager.addRWXMaterial(newRWXMat, signature)
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
        child.material = newMaterials
        child.material.needsUpdate = true
      }
    })
    return forkJoin(promises)
  }

  loadObject(name: string, basic = false): Observable<any> {
    name = Utils.modelName(name)
    const object = this.objects.get(name)
    if (object !== undefined) {
      return object
    }
    const loader = basic ? this.basicLoader : this.rwxPropLoader
    const observable = new Observable((observer) => {
      loader.load(
        name,
        (rwx: Group) => observer.next(rwx),
        null,
        () => observer.next(this.unknown)
      )
    })
    this.objects.set(name, observable)
    return observable.pipe(
      map((newObject: Observable<Group>) => newObject),
      catchError(() => of(this.unknown))
    )
  }

  loadAvatar(name: string, basic = false): Observable<any> {
    name = Utils.modelName(name)
    const avatar = this.avatars.get(name)
    if (avatar !== undefined) {
      return avatar
    }
    const loader = basic ? this.basicLoader : this.rwxAvatarLoader
    const observable = new Observable((observer) => {
      loader.load(
        name,
        (rwx: Group) => observer.next(rwx),
        null,
        () => observer.next(this.unknown)
      )
    })
    this.avatars.set(name, observable)
    return observable.pipe(
      map((newAvatar: Observable<Group>) => newAvatar),
      catchError(() => of(this.unknown))
    )
  }

  cleanCache() {
    this.objects.clear()
  }

  public texturesNextFrame() {
    this.rwxMaterialManager.texturesNextFrame()
  }
}
