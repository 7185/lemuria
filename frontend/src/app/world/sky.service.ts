import {effect, inject, Injectable, signal} from '@angular/core'
import {colorHexToStr, colorStrToHex, hexToRgb, rgbToHex} from '../utils/utils'
import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Vector3
} from 'three'
import {SRGBToLinear} from 'three/src/math/ColorManagement.js'
import {EngineService} from '../engine/engine.service'
import {PropService} from './prop.service'

export interface SkyData {
  skybox: string
  top_color: [number, number, number]
  north_color: [number, number, number]
  east_color: [number, number, number]
  south_color: [number, number, number]
  west_color: [number, number, number]
  bottom_color: [number, number, number]
}

@Injectable({providedIn: 'root'})
export class SkyService {
  private readonly engineSvc = inject(EngineService)
  private readonly propSvc = inject(PropService)

  skybox = signal('')
  skyTop = signal(colorHexToStr(0))
  skyNorth = signal(colorHexToStr(0))
  skyEast = signal(colorHexToStr(0))
  skySouth = signal(colorHexToStr(0))
  skyWest = signal(colorHexToStr(0))
  skyBottom = signal(colorHexToStr(0))

  constructor() {
    effect(() => {
      this.createSkybox(this.skybox(), {
        top: hexToRgb(colorStrToHex(this.skyTop())),
        north: hexToRgb(colorStrToHex(this.skyNorth())),
        east: hexToRgb(colorStrToHex(this.skyEast())),
        south: hexToRgb(colorStrToHex(this.skySouth())),
        west: hexToRgb(colorStrToHex(this.skyWest())),
        bottom: hexToRgb(colorStrToHex(this.skyBottom()))
      })
    })
  }

  setSkybox(sky: SkyData) {
    this.skybox.set(sky.skybox)
    this.skyTop.set(colorHexToStr(rgbToHex(...sky.top_color)))
    this.skyNorth.set(colorHexToStr(rgbToHex(...sky.north_color)))
    this.skyEast.set(colorHexToStr(rgbToHex(...sky.east_color)))
    this.skySouth.set(colorHexToStr(rgbToHex(...sky.south_color)))
    this.skyWest.set(colorHexToStr(rgbToHex(...sky.west_color)))
    this.skyBottom.set(colorHexToStr(rgbToHex(...sky.bottom_color)))
  }

  private createSkybox(
    skybox: string,
    skyColors: {
      top: [number, number, number]
      north: [number, number, number]
      east: [number, number, number]
      south: [number, number, number]
      west: [number, number, number]
      bottom: [number, number, number]
    } = {
      top: [0, 0, 0],
      north: [0, 0, 0],
      east: [0, 0, 0],
      south: [0, 0, 0],
      west: [0, 0, 0],
      bottom: [0, 0, 0]
    }
  ) {
    const skyboxGroup = new Group()
    skyboxGroup.renderOrder = -1
    const octGeom = new BufferGeometry()

    // 6 vertices to make an octahedron
    // prettier-ignore
    const positions = [
           0,  0,  1, // north vertex (0)
          -1,  0,  0, // east vertex (1)
           0,  0, -1, // south vertex (2)
           1,  0,  0, // west vertex (3)
           0,  1,  0, // top vertex (4)
           0, -1,  0  // bottom vertex (5)
        ]

    const colors = ['north', 'east', 'south', 'west', 'top', 'bottom']
      .flatMap((attr) => skyColors[attr])
      .map((c: number) => SRGBToLinear(c / 255))

    octGeom.setAttribute(
      'position',
      new BufferAttribute(new Float32Array(positions), 3)
    )
    octGeom.setAttribute(
      'color',
      new BufferAttribute(new Float32Array(colors), 3)
    )

    // 8 triangle faces to make an octahedron
    // prettier-ignore
    octGeom.setIndex([
          4, 0, 1, // top north east face
          4, 1, 2, // top south east face
          4, 2, 3, // top south west face
          4, 3, 0, // top north west face
          5, 1, 0, // bottom north east face
          5, 2, 1, // bottom south east face
          5, 3, 2, // bottom south west face
          5, 0, 3  // bottom north west face
        ])

    octGeom.addGroup(0, octGeom.getIndex()!.count, 0)
    skyboxGroup.add(
      new Mesh(octGeom, [
        new MeshBasicMaterial({vertexColors: true, depthWrite: false})
      ])
    )

    if (skybox) {
      this.propSvc.loadModel(skybox, true).subscribe((s) => {
        const skyboxRwx = s.clone()
        const center = new Box3()
          .setFromObject(skyboxRwx)
          .getCenter(new Vector3())
        skyboxRwx.position.set(0, -center.y, 0)
        skyboxGroup.add(skyboxRwx)
      })
    }
    this.engineSvc.setSkybox(skyboxGroup)
  }
}
