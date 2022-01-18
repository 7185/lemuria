import {forkJoin, Subject} from 'rxjs'
import type {Observable} from 'rxjs'
import {Injectable} from '@angular/core'
import {HttpService} from './../network/http.service'
import {AWActionParser} from 'aw-action-parser'
import {Group, Mesh, BufferAttribute, BufferGeometry, LoadingManager, MeshBasicMaterial,
  CanvasTexture, TextureLoader, sRGBEncoding} from 'three'
import type {MeshPhongMaterial, Object3D} from 'three'
import RWXLoader, {RWXMaterialManager} from 'three-rwx-loader'
import * as JSZip from 'jszip'
import JSZipUtils from 'jszip-utils'
import {config} from '../app.config'

// can't be const (angular#25963)
export enum ObjectAct { nop = 0, forward, backward, left, right, up, down, rotX, rotnX, rotY, rotnY, rotZ, rotnZ,
   copy, delete, rotReset, snapGrid, deselect }

@Injectable({providedIn: 'root'})
export class ObjectService {

  public objectAction = new Subject<ObjectAct>()
  private unknown: Group
  private rwxLoader = new RWXLoader(new LoadingManager())
  private basicLoader = new RWXLoader(new LoadingManager())
  private rwxMaterialManager: RWXMaterialManager
  private actionParser = new AWActionParser()
  private objects: Map<string, Promise<any>> = new Map()
  private pictureLoader = new TextureLoader()
  private path = 'http://localhost'
  private remoteUrl = /.+\..+\/.+/g

  constructor(private http: HttpService) {
    const unknownGeometry = new BufferGeometry()
    const positions = [
      -0.2,  0.0,  0.0,
       0.2,  0.0,  0.0,
       0.0,  0.2,  0.0
    ]
    unknownGeometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
    unknownGeometry.setIndex([0, 1, 2])
    unknownGeometry.clearGroups()
    unknownGeometry.addGroup(0, unknownGeometry.getIndex().count, 0)
    this.unknown = new Group().add(new Mesh(unknownGeometry, [new MeshBasicMaterial({color: 0x000000})]))
    this.unknown.userData.isError = true
    this.rwxMaterialManager = new RWXMaterialManager(this.path, 'jpg', 'zip', JSZip, JSZipUtils, false, sRGBEncoding)
    this.rwxLoader.setRWXMaterialManager(this.rwxMaterialManager).setFlatten(true)
    this.basicLoader.setJSZip(JSZip, JSZipUtils).setFlatten(true).setUseBasicMaterial(true).setTextureEncoding(sRGBEncoding)
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
        } else {
          if (cmd.commandType === 'color') {
            texturing = this.applyTexture(item, null, null, cmd.color)
          } else {
            if (cmd.commandType === 'texture') {
              if (cmd.texture) {
                cmd.texture = cmd.texture.lastIndexOf('.') !== -1 ? cmd.texture.substring(0, cmd.texture.lastIndexOf('.')) : cmd.texture
                if (cmd.mask) {
                  cmd.mask = cmd.mask.lastIndexOf('.') !== -1 ? cmd.mask.substring(0, cmd.mask.lastIndexOf('.')) : cmd.mask
                }
              }
              texturing = this.applyTexture(item, cmd.texture, cmd.mask)
            }
          }
          if (!textured) {
            if (cmd.commandType === 'sign') {
              this.makeSign(item, cmd.color, cmd.bcolor)
            }
            if (cmd.commandType === 'picture') {
              this.makePicture(item, cmd.resource)
            }
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
          item.userData.teleportClick = cmd.coordinates[0]
        }
      }
    }
    if (textured) {
      texturing.subscribe(() => {
        for (const cmd of result.create) {
          if (cmd.commandType === 'sign') {
            this.makeSign(item, cmd.color, cmd.bcolor)
          }
          if (cmd.commandType === 'picture') {
            this.makePicture(item, cmd.resource)
          }
        }
      })
    }
  }

  makePicture(item: Group, url: string) {
    if (url.match(this.remoteUrl)) {
      url = `${config.url.imgProxy}${url}`
    } else {
      url = `${this.path}/textures/${url}`
    }
    this.pictureLoader.load(url, (image) => {
      image.encoding = sRGBEncoding
      item.traverse((child: Object3D) => {
        if (child instanceof Mesh) {
          const newMaterials = []
          newMaterials.push(...child.material)
          if (item.userData.taggedMaterials[200]) {
            for (const i of item.userData.taggedMaterials[200]) {
              newMaterials[i] = child.material[i].clone()
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

  makeSign(item: Group, color, bcolor) {
    if (color == null) {
      color = {r: 255, g: 255, b: 255}
    }
    if (bcolor == null) {
      bcolor = {r: 0, g: 0, b: 255}
    }
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = `rgb(${bcolor.r},${bcolor.g},${bcolor.b})`
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = `rgb(${color.r},${color.g},${color.b})`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    let txt = ''
    if (item.userData.desc != null) {
      txt = item.userData.desc
    }

    const fontSizes = [120, 50, 40, 30, 20, 10, 5]
    let fontIndex = 0

    const words = txt.split(/([ \n])/)
    let lines = ['']
    const maxWidth = canvas.width * 0.9
    const maxHeight = canvas.height * 0.9

    ctx.font = `${fontSizes[fontIndex]}px Arial`

    // TODO: use a proper way to get line height from font size
    const fontSizeToHeightRatio = 1.2
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

      if (words[curWordIndex] !== '\n' && ctx.measureText(tentativeLine).width <= maxWidth) {
        // TODO: use actualBoundingBoxLeft and actualBoundingBoxRight instead of .width
        // Adding word to end of line
        lines[curLine] = tentativeLine
        curWordIndex += 1
      } else if (ctx.measureText(tentativeWord).width <= maxWidth && lineHeight * (curLine + 1) <= maxHeight) {
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
      ctx.fillText(line, canvas.width / 2, canvas.height / 2 + i * lineHeight - (lines.length - 1) * lineHeight / 2)
    })

    item.traverse((child: Object3D) => {
      if (child instanceof Mesh) {
        const newMaterials = []
        newMaterials.push(...child.material)
        if (item.userData.taggedMaterials[100]) {
          for (const i of item.userData.taggedMaterials[100]) {
            newMaterials[i] = child.material[i].clone()
            newMaterials[i].map = new CanvasTexture(canvas)
            newMaterials[i].map.encoding = sRGBEncoding
          }
        }
        child.material = newMaterials
        child.material.needsUpdate = true
      }
    })
  }

  applyTexture(item: Group, textureName: string = null, maskName: string = null, color: any = null): Observable<any> {
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
              newRWXMat.color = [color.r / 255.0, color.g / 255.0, color.b / 255.0]
            }
            this.rwxMaterialManager.currentRWXMaterial = newRWXMat
            const curMat = this.rwxMaterialManager.getCurrentMaterial()
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
    this.rwxMaterialManager.resetCurrentMaterialList()
    return forkJoin(promises)
  }

  loadObject(name: string, basic = false): Promise<any> {
    if (this.objects.get(name) !== undefined) {
      return this.objects.get(name)
    } else {
      const loader = basic ? this.basicLoader : this.rwxLoader
      const promise = new Promise((resolve) => {
        loader.load(name, (rwx: Group) => resolve(rwx), null, () => resolve(this.unknown))
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
