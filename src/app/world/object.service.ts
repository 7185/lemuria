import {Subject} from 'rxjs'
import {Injectable} from '@angular/core'
import {HttpService} from './../network/http.service'
import {Group, Mesh, ConeGeometry, LoadingManager, MeshBasicMaterial, CanvasTexture} from 'three'
import type {MeshPhongMaterial, Object3D} from 'three'
import RWXLoader, {RWXMaterialManager} from 'three-rwx-loader'
import * as JSZip from 'jszip'
import JSZipUtils from 'jszip-utils'

// can't be const (angular#25963)
export enum ObjectAct { nop = 0, forward, backward, left, right, up, down, rotX, rotnX, rotY, rotnY, rotZ, rotnZ,
   copy, delete, rotReset, snapGrid, deselect }

@Injectable({providedIn: 'root'})
export class ObjectService {

  public objectAction = new Subject<ObjectAct>()
  private errorCone: Group
  private rwxLoader = new RWXLoader(new LoadingManager())
  private basicLoader = new RWXLoader(new LoadingManager())
  private rwxMaterialManager: RWXMaterialManager
  private objects: Map<string, Promise<any>> = new Map()
  private path = 'http://localhost'

  constructor(private http: HttpService) {
    const coneGeometry = new ConeGeometry(0.5, 0.5, 3)
    coneGeometry.clearGroups()
    coneGeometry.addGroup(0, coneGeometry.getIndex().count, 0)
    const cone = new Mesh(coneGeometry, [new MeshBasicMaterial({color: 0x000000})])
    cone.position.y = 0.5
    this.errorCone = new Group().add(cone)
    this.errorCone.userData.isError = true
    this.rwxMaterialManager = new RWXMaterialManager(this.path, 'jpg', 'zip', JSZip, JSZipUtils)
    this.rwxLoader.setRWXMaterialManager(this.rwxMaterialManager).setFlatten(true)
    this.basicLoader.setJSZip(JSZip, JSZipUtils).setFlatten(true).setUseBasicMaterial(true)
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
          }
        }
        child.material = newMaterials
        child.material.needsUpdate = true
      }
    })
  }

  applyTexture(item: Group, textureName: string = null, maskName: string = null, color: any = null) {
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
            newMaterials.push(this.rwxMaterialManager.getCurrentMaterial().threeMat)
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
  }

  loadObject(name: string, basic = false): Promise<any> {
    if (this.objects.get(name) !== undefined) {
      return this.objects.get(name)
    } else {
      const loader = basic ? this.basicLoader : this.rwxLoader
      const promise = new Promise((resolve) => {
        loader.load(name, (rwx: Group) => resolve(rwx), null, () => resolve(this.errorCone))
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
