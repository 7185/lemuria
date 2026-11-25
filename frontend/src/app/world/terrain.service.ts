import type {Observable} from 'rxjs'
import type {Vector3} from 'three'
import type {BVHOptions, MeshBVH} from 'three-mesh-bvh'
import {HttpClient} from '@angular/common/http'
import {inject, Service, signal} from '@angular/core'
import {forkJoin, from, map} from 'rxjs'
import {
  BufferAttribute,
  ClampToEdgeWrapping,
  Color,
  Group,
  ImageBitmapLoader,
  Mesh,
  MeshLambertMaterial,
  PlaneGeometry,
  RepeatWrapping,
  SRGBColorSpace,
  Texture
} from 'three'
import {BVHHelper} from 'three-mesh-bvh'
import type {PropCtl} from './prop.service'
import {environment} from '../../environments/environment'
import {BuildService} from '../engine/build.service'
import {EngineService} from '../engine/engine.service'
import {InputSystemService} from '../engine/inputsystem.service'
import {TERRAIN_HOLE_FLAG, TERRAIN_PAGE_SIZE} from '../utils/constants'
import {rgbToHex} from '../utils/utils'
import {PropService} from './prop.service'

export interface WaterData {
  enabled?: boolean
  color?: number[]
  offset?: number
  opacity?: number
  texture_bottom?: string
  texture_top?: string
  under_view?: number
}

export interface TerrainData {
  enabled: boolean
  offset: number
}

interface CopiedCell {
  height: number
  texture: number
  rotation: number
  hole: boolean
}

@Service()
export class TerrainService {
  terrain: Group | null = null
  water: Group | null = null
  hasCopiedCell = signal(false)
  private readonly http = inject(HttpClient)
  private readonly buildSvc = inject(BuildService)
  private readonly engineSvc = inject(EngineService)
  private readonly inputSysSvc = inject(InputSystemService)
  private readonly propSvc = inject(PropService)
  private copiedCell: CopiedCell | null = null
  private textureLoader = new ImageBitmapLoader().setOptions({
    imageOrientation: 'flipY'
  })
  private terrainMaterials: MeshLambertMaterial[] = []
  private waterBottomGeom: PlaneGeometry | null = null
  private waterTopGeom: PlaneGeometry | null = null
  private waterBottomMaterials: MeshLambertMaterial[] = []
  private waterTopMaterials: MeshLambertMaterial[] = []
  private loadingPages = new Set()

  constructor() {
    this.buildSvc.cellControl.subscribe(({action, cameraDirection}) => {
      this.handleCellControl(action, cameraDirection)
    })
  }

  getTerrain(worldId: number, pageX: number, pageZ: number) {
    return this.http.get(`${environment.url.server}/world/${worldId}/terrain`, {
      params: {page_x: pageX, page_z: pageZ}
    })
  }

  setWater(water: WaterData | null = null) {
    if (this.water != null) {
      this.engineSvc.removeWorldObject(this.water)
    }
    if (!water?.enabled) {
      this.water = null
      return
    }
    this.water = new Group()
    this.water.name = 'water'
    this.water.userData.under_view = water.under_view ?? 120
    this.water.userData.color = rgbToHex(
      ...((water?.color || [0, 255, 255]) as [number, number, number])
    )
    this.water.userData.texture_bottom = water.texture_bottom
    this.water.userData.texture_top = water.texture_top
    this.water.userData.opacity = water?.opacity ?? 128

    this.waterTopGeom = new PlaneGeometry(
      TERRAIN_PAGE_SIZE * 10,
      TERRAIN_PAGE_SIZE * 10
    )
    this.waterTopGeom.rotateX(-Math.PI / 2)
    this.waterTopGeom.addGroup(0, this.waterTopGeom.getIndex()!.count, 0)
    this.waterBottomGeom = new PlaneGeometry(
      TERRAIN_PAGE_SIZE * 10,
      TERRAIN_PAGE_SIZE * 10
    )
    this.waterBottomGeom.rotateX(Math.PI / 2)
    this.waterBottomGeom.addGroup(0, this.waterBottomGeom.getIndex()!.count, 0)

    const waterMaterialBottom = new MeshLambertMaterial({
      transparent: true,
      color: new Color(this.water.userData.color),
      opacity: this.water.userData.opacity / 255
    })
    this.waterBottomMaterials = [waterMaterialBottom]

    const waterMaterialTop = new MeshLambertMaterial({
      transparent: true,
      color: new Color(this.water.userData.color),
      opacity: this.water.userData.opacity / 255
    })
    this.waterTopMaterials = [waterMaterialTop]

    if (water?.texture_bottom) {
      this.textureLoader.load(
        `${this.propSvc.path()}/textures/${water.texture_bottom}.jpg`,
        (bitmap) => {
          if (!bitmap || bitmap.width === 0 || bitmap.height === 0) {
            return
          }
          const bottomTexture = new Texture(
            bitmap,
            Texture.DEFAULT_MAPPING,
            RepeatWrapping,
            RepeatWrapping
          )
          bottomTexture.colorSpace = SRGBColorSpace
          bottomTexture.repeat.set(TERRAIN_PAGE_SIZE, TERRAIN_PAGE_SIZE)
          bottomTexture.needsUpdate = true
          waterMaterialBottom.map = bottomTexture
          waterMaterialBottom.needsUpdate = true
        }
      )
    }

    if (water?.texture_top) {
      this.textureLoader.load(
        `${this.propSvc.path()}/textures/${water.texture_top}.jpg`,
        (bitmap) => {
          if (!bitmap || bitmap.width === 0 || bitmap.height === 0) {
            return
          }
          const topTexture = new Texture(
            bitmap,
            Texture.DEFAULT_MAPPING,
            RepeatWrapping,
            RepeatWrapping
          )
          topTexture.colorSpace = SRGBColorSpace
          topTexture.repeat.set(TERRAIN_PAGE_SIZE, TERRAIN_PAGE_SIZE)
          topTexture.needsUpdate = true
          waterMaterialTop.map = topTexture
          waterMaterialTop.needsUpdate = true
        }
      )
    }

    if (water?.offset != null) {
      this.water.position.setY(water.offset)
    }
    this.engineSvc.addWorldObject(this.water)
  }

  setTerrain(terrain: TerrainData | null = null) {
    if (this.terrain != null) {
      this.engineSvc.removeWorldObject(this.terrain)
    }
    if (!terrain?.enabled) {
      this.terrain = null
      return
    }

    this.terrain = new Group()
    this.terrain.name = 'terrain'
    this.terrainMaterials = []

    const textureObservables: Observable<Texture>[] = []

    for (let j = 0; j < 63; j++) {
      textureObservables.push(
        from(
          this.textureLoader.loadAsync(
            `${this.propSvc.path()}/textures/terrain${j}.jpg`
          )
        ).pipe(
          map((bitmap) => {
            if (!bitmap || bitmap.width === 0 || bitmap.height === 0) {
              return null
            }
            const baseTexture = new Texture(
              bitmap,
              Texture.DEFAULT_MAPPING,
              ClampToEdgeWrapping,
              ClampToEdgeWrapping
            )
            baseTexture.colorSpace = SRGBColorSpace
            baseTexture.needsUpdate = true
            return baseTexture
          })
        )
      )
    }

    forkJoin(textureObservables).subscribe((baseTextures) => {
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 64; j++) {
          const terrainTexture = j < 63 ? baseTextures[j] : null
          const material = new MeshLambertMaterial({map: terrainTexture})
          if (terrainTexture != null) {
            this.applyClampedCellShader(material, i)
          }
          this.terrainMaterials.push(material)
        }
      }

      if (terrain?.offset != null) {
        this.terrain.position.setY(terrain.offset)
      }
      this.engineSvc.addWorldObject(this.terrain)
      this.terrain.updateMatrixWorld()
    })
  }

  private applyClampedCellShader(
    material: MeshLambertMaterial,
    rotation: number
  ) {
    material.customProgramCacheKey = () => 'terrain-clamped'
    material.onBeforeCompile = (shader) => {
      shader.uniforms['uTerrainRot'] = {value: rotation}
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <uv_pars_vertex>',
          `#include <uv_pars_vertex>
varying vec2 vCellCoord;
flat varying vec2 vCellOrigin;`
        )
        .replace(
          '#include <uv_vertex>',
          `#include <uv_vertex>
vCellCoord = uv * ${TERRAIN_PAGE_SIZE}.0;
vCellOrigin = vCellCoord - vec2(1.0);`
        )
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <uv_pars_fragment>',
          `#include <uv_pars_fragment>
uniform int uTerrainRot;
varying vec2 vCellCoord;
flat varying vec2 vCellOrigin;`
        )
        .replace(
          '#include <map_fragment>',
          `#ifdef USE_MAP
  vec2 cellUv = clamp(vCellCoord - vCellOrigin, 0.0, 1.0);
  vec2 ddx = dFdx(vCellCoord);
  vec2 ddy = dFdy(vCellCoord);
  vec2 rotUv = cellUv;
  vec2 rotDdx = ddx;
  vec2 rotDdy = ddy;
  if (uTerrainRot == 1) {
    rotUv = vec2(cellUv.y, 1.0 - cellUv.x);
    rotDdx = vec2(ddx.y, -ddx.x);
    rotDdy = vec2(ddy.y, -ddy.x);
  } else if (uTerrainRot == 2) {
    rotUv = vec2(1.0 - cellUv.x, 1.0 - cellUv.y);
    rotDdx = -ddx;
    rotDdy = -ddy;
  } else if (uTerrainRot == 3) {
    rotUv = vec2(1.0 - cellUv.y, cellUv.x);
    rotDdx = vec2(-ddx.y, ddx.x);
    rotDdy = vec2(-ddy.y, ddy.x);
  }
  diffuseColor *= textureGrad(map, rotUv, rotDdx, rotDdy);
#endif`
        )
    }
  }

  getTerrainPages(
    playerX: number,
    playerZ: number,
    radius: number,
    worldId: number
  ) {
    // Since the pages are centered, we need to add an offset
    const centerOffset = (TERRAIN_PAGE_SIZE * 10) / 2
    const pageX: number = Math.floor(
      (playerX + centerOffset) / (TERRAIN_PAGE_SIZE * 10)
    )
    const pageZ: number = Math.floor(
      (playerZ + centerOffset) / (TERRAIN_PAGE_SIZE * 10)
    )

    const pages: [number, number][] = []
    for (let i = -radius; i <= radius; i++) {
      for (let j = -radius; j <= radius; j++) {
        pages.push([pageX + i, pageZ + j])
      }
    }

    pages.sort((a, b) => {
      const distanceA: number = Math.sqrt(
        (a[0] - pageX) ** 2 + (a[1] - pageZ) ** 2
      )
      const distanceB: number = Math.sqrt(
        (b[0] - pageX) ** 2 + (b[1] - pageZ) ** 2
      )
      return distanceA - distanceB
    })

    pages.forEach((page) => {
      if (
        !this.terrain?.children?.find(
          (m) => m.name === `${page[0]}_${page[1]}`
        ) &&
        !this.loadingPages.has(`${page[0]}_${page[1]}`)
      ) {
        this.setTerrainPage(page[0], page[1], worldId)
      }
      if (
        !this.water?.children?.find((m) => m.name === `${page[0]}_${page[1]}`)
      ) {
        this.setWaterPage(page[0], page[1])
      }
    })
  }

  private setTerrainPage(xPage: number, zPage: number, worldId: number) {
    if (this.terrain == null) {
      // Terrain is disabled or not ready
      return
    }

    this.loadingPages.add(`${xPage}_${zPage}`)

    this.getTerrain(worldId, xPage, zPage).subscribe((elevData) => {
      const geometry = new PlaneGeometry(
        TERRAIN_PAGE_SIZE * 10,
        TERRAIN_PAGE_SIZE * 10,
        TERRAIN_PAGE_SIZE,
        TERRAIN_PAGE_SIZE
      )
      geometry.rotateX(-Math.PI / 2)

      const positions = geometry.getAttribute('position') as BufferAttribute
      const stride = TERRAIN_PAGE_SIZE + 1
      for (let z = 0; z < TERRAIN_PAGE_SIZE; z++) {
        const rowOffset = z * TERRAIN_PAGE_SIZE
        const vertexRow = z * stride
        for (let x = 0; x < TERRAIN_PAGE_SIZE; x++) {
          positions.setY(vertexRow + x, elevData[rowOffset + x]?.[1] / 100 || 0)
        }
      }

      const textures = new Uint16Array(TERRAIN_PAGE_SIZE * TERRAIN_PAGE_SIZE)
      for (let k = 0; k < TERRAIN_PAGE_SIZE * TERRAIN_PAGE_SIZE; k++) {
        const raw = elevData[k] == null ? 0 : elevData[k][0]
        textures[k] = raw === 254 ? TERRAIN_HOLE_FLAG : raw
      }

      const terrainMesh = new Mesh(geometry, this.terrainMaterials)
      terrainMesh.name = `${xPage}_${zPage}`
      terrainMesh.userData.textures = textures
      terrainMesh.userData.pageX = xPage
      terrainMesh.userData.pageZ = zPage
      this.rebuildPageIndices(terrainMesh)
      geometry.computeVertexNormals()
      terrainMesh.position.set(
        xPage * TERRAIN_PAGE_SIZE * 10,
        0,
        zPage * TERRAIN_PAGE_SIZE * 10
      )
      this.terrain!.add(terrainMesh)
      this.fixPageGaps(terrainMesh, xPage, zPage)
      this.loadingPages.delete(`${xPage}_${zPage}`)
    })
  }

  setSelectedCellHeight(height: number) {
    const {page, cellX, cellZ} = this.buildSvc.selectedCell()
    if (page == null || cellX == null || cellZ == null) {
      return
    }
    const clamped =
      Math.round(Math.max(-328, Math.min(328, height)) * 100) / 100
    this.setCellHeight(page, cellX, cellZ, clamped)
    this.buildSvc.selectedCell.update((cell) => ({...cell, height: clamped}))
    this.buildSvc.refreshCellSelection()
  }

  setSelectedCellTexture(texture: number) {
    const {page, cellX, cellZ, rotation, hole} = this.buildSvc.selectedCell()
    if (page == null || cellX == null || cellZ == null) {
      return
    }
    const clamped = Math.max(0, Math.min(62, Math.trunc(texture)))
    this.setCellTexture(
      page,
      cellX,
      cellZ,
      clamped,
      rotation ?? 0,
      hole ?? false
    )
    this.buildSvc.selectedCell.update((cell) => ({...cell, texture: clamped}))
  }

  rotateSelectedCell(delta: 1 | -1) {
    const {page, cellX, cellZ, texture, rotation, hole} =
      this.buildSvc.selectedCell()
    if (page == null || cellX == null || cellZ == null) {
      return
    }
    const nextRotation = ((rotation ?? 0) + delta + 4) & 3
    this.setCellTexture(
      page,
      cellX,
      cellZ,
      texture ?? 0,
      nextRotation,
      hole ?? false
    )
    this.buildSvc.selectedCell.update((cell) => ({
      ...cell,
      rotation: nextRotation
    }))
  }

  setSelectedCellHole(hole: boolean) {
    const {page, cellX, cellZ, texture, rotation} = this.buildSvc.selectedCell()
    if (page == null || cellX == null || cellZ == null) {
      return
    }
    this.setCellTexture(page, cellX, cellZ, texture ?? 0, rotation ?? 0, hole)
    this.buildSvc.selectedCell.update((cell) => ({...cell, hole}))
  }

  copySelectedCell() {
    const {height, texture, rotation, hole} = this.buildSvc.selectedCell()
    if (height == null) {
      return
    }
    this.copiedCell = {
      height,
      texture: texture ?? 0,
      rotation: rotation ?? 0,
      hole: hole ?? false
    }
    this.hasCopiedCell.set(true)
  }

  pasteElevation() {
    if (this.copiedCell == null) {
      return
    }
    this.setSelectedCellHeight(this.copiedCell.height)
  }

  pasteTexture() {
    if (this.copiedCell == null) {
      return
    }
    const {page, cellX, cellZ} = this.buildSvc.selectedCell()
    if (page == null || cellX == null || cellZ == null) {
      return
    }
    const {texture, rotation, hole} = this.copiedCell
    this.setCellTexture(page, cellX, cellZ, texture, rotation, hole)
    this.buildSvc.selectedCell.update((cell) => ({
      ...cell,
      texture,
      rotation,
      hole
    }))
  }

  private handleCellControl(action: PropCtl, cameraDirection: Vector3) {
    if (action === 'deselect') {
      this.buildSvc.deselectCell()
      return
    }
    const {page, cellX, cellZ, height, hole} = this.buildSvc.selectedCell()
    if (page == null || cellX == null || cellZ == null) {
      return
    }
    let step = 0.5
    if (this.inputSysSvc.controls['clip']) {
      step = 0.05
      if (this.inputSysSvc.controls['run']) {
        step = 0.01
      }
    }
    let dirX = 0
    let dirZ = 0
    if (Math.abs(cameraDirection.x) >= Math.abs(cameraDirection.z)) {
      dirX = Math.sign(cameraDirection.x)
    } else {
      dirZ = Math.sign(cameraDirection.z)
    }
    switch (action) {
      case 'up':
        this.setSelectedCellHeight((height ?? 0) + step)
        break
      case 'down':
        this.setSelectedCellHeight((height ?? 0) - step)
        break
      case 'forward':
        this.stepSelectedCell(page, cellX, cellZ, dirX, dirZ)
        break
      case 'backward':
        this.stepSelectedCell(page, cellX, cellZ, -dirX, -dirZ)
        break
      case 'left':
        this.stepSelectedCell(page, cellX, cellZ, dirZ, -dirX)
        break
      case 'right':
        this.stepSelectedCell(page, cellX, cellZ, -dirZ, dirX)
        break
      case 'rotY':
        this.rotateSelectedCell(1)
        break
      case 'rotnY':
        this.rotateSelectedCell(-1)
        break
      case 'copy':
        this.copySelectedCell()
        break
      case 'delete':
        this.setSelectedCellHole(!(hole ?? false))
        break
      default:
        break
    }
  }

  private stepSelectedCell(
    page: Mesh,
    cellX: number,
    cellZ: number,
    dx: number,
    dz: number
  ) {
    let nextX = cellX + dx
    let nextZ = cellZ + dz
    let pageX = page.userData.pageX as number
    let pageZ = page.userData.pageZ as number

    if (nextX < 0) {
      pageX--
      nextX = TERRAIN_PAGE_SIZE - 1
    } else if (nextX >= TERRAIN_PAGE_SIZE) {
      pageX++
      nextX = 0
    }
    if (nextZ < 0) {
      pageZ--
      nextZ = TERRAIN_PAGE_SIZE - 1
    } else if (nextZ >= TERRAIN_PAGE_SIZE) {
      pageZ++
      nextZ = 0
    }

    const targetPage =
      pageX === page.userData.pageX && pageZ === page.userData.pageZ
        ? page
        : this.getPage(pageX, pageZ)
    if (targetPage != null) {
      this.buildSvc.selectCellAt(targetPage, nextX, nextZ)
    }
  }

  private setCellHeight(
    page: Mesh,
    cellX: number,
    cellZ: number,
    height: number
  ) {
    const stride = TERRAIN_PAGE_SIZE + 1
    const northRow = TERRAIN_PAGE_SIZE * stride
    const positions = page.geometry.getAttribute('position') as BufferAttribute
    positions.setY(cellZ * stride + cellX, height)
    positions.needsUpdate = true
    page.geometry.computeVertexNormals()
    this.refitTerrainBVH(page)

    const xPage = page.userData.pageX as number
    const zPage = page.userData.pageZ as number
    if (cellZ === 0) {
      const south = this.getPage(xPage, zPage - 1)
      if (south != null) {
        const southPos = south.geometry.getAttribute(
          'position'
        ) as BufferAttribute
        southPos.setY(northRow + cellX, height)
        southPos.needsUpdate = true
        south.geometry.computeVertexNormals()
        this.refitTerrainBVH(south)
      }
    }
    if (cellX === 0) {
      const east = this.getPage(xPage - 1, zPage)
      if (east != null) {
        const eastPos = east.geometry.getAttribute(
          'position'
        ) as BufferAttribute
        eastPos.setY(cellZ * stride + TERRAIN_PAGE_SIZE, height)
        eastPos.needsUpdate = true
        east.geometry.computeVertexNormals()
        this.refitTerrainBVH(east)
      }
    }
    if (cellX === 0 && cellZ === 0) {
      const southEast = this.getPage(xPage - 1, zPage - 1)
      if (southEast != null) {
        const sePos = southEast.geometry.getAttribute(
          'position'
        ) as BufferAttribute
        sePos.setY(northRow + TERRAIN_PAGE_SIZE, height)
        sePos.needsUpdate = true
        southEast.geometry.computeVertexNormals()
        this.refitTerrainBVH(southEast)
      }
    }
  }

  private setCellTexture(
    page: Mesh,
    cellX: number,
    cellZ: number,
    texture: number,
    rotation: number,
    hole: boolean
  ) {
    const textures = page.userData.textures as Uint16Array
    const idx = cellZ * TERRAIN_PAGE_SIZE + cellX
    const prevHole = (textures[idx] & TERRAIN_HOLE_FLAG) !== 0
    const nextValue =
      ((rotation & 3) << 6) | (texture & 63) | (hole ? TERRAIN_HOLE_FLAG : 0)
    if (textures[idx] === nextValue) {
      return
    }
    textures[idx] = nextValue
    this.rebuildPageIndices(page)
    if (prevHole !== hole) {
      page.geometry.computeVertexNormals()
    }
    this.updateTerrainBVH(page)
  }

  private rebuildPageIndices(terrainMesh: Mesh) {
    const geometry = terrainMesh.geometry
    const textures = terrainMesh.userData.textures as Uint16Array
    const stride = TERRAIN_PAGE_SIZE + 1
    const buckets = new Map<number, number[]>()
    let totalIndices = 0

    for (let z = 0; z < TERRAIN_PAGE_SIZE; z++) {
      const rowOffset = z * TERRAIN_PAGE_SIZE
      const vertexRow = z * stride
      for (let x = 0; x < TERRAIN_PAGE_SIZE; x++) {
        const raw = textures[rowOffset + x]
        if ((raw & TERRAIN_HOLE_FLAG) !== 0) {
          // Empty cell
          continue
        }
        const texture = raw & 0xff
        let bucket = buckets.get(texture)
        if (bucket === undefined) {
          bucket = []
          buckets.set(texture, bucket)
        }
        const a = vertexRow + x
        const b = a + stride
        const c = b + 1
        const d = a + 1
        bucket.push(a, b, d, b, c, d)
        totalIndices += 6
      }
    }

    const groupedIndices = new Uint16Array(totalIndices)
    geometry.clearGroups()
    let offset = 0
    for (const [texture, bucket] of buckets) {
      groupedIndices.set(bucket, offset)
      geometry.addGroup(offset, bucket.length, texture)
      offset += bucket.length
    }

    geometry.setIndex(new BufferAttribute(groupedIndices, 1))
  }

  private getPage(xPage: number, zPage: number) {
    return this.terrain!.getObjectByName(`${xPage}_${zPage}`) as Mesh
  }

  /**
   * Fix the height gaps between the pages
   * Called only once per new page and calculate the BVH (or recalculate for neighbors)
   *
   * @param page Terrain page mesh
   * @param xPage X coordinate for page
   * @param zPage Z coordinate for page
   */
  private fixPageGaps(page: Mesh, xPage: number, zPage: number) {
    const pages = {
      north: this.getPage(xPage, zPage + 1),
      west: this.getPage(xPage + 1, zPage),
      south: this.getPage(xPage, zPage - 1),
      east: this.getPage(xPage - 1, zPage),
      northWest: this.getPage(xPage + 1, zPage + 1),
      southEast: this.getPage(xPage - 1, zPage - 1)
    }

    const stride = TERRAIN_PAGE_SIZE + 1
    const northRow = TERRAIN_PAGE_SIZE * stride
    const nwCorner = northRow + TERRAIN_PAGE_SIZE
    const positions = page.geometry.getAttribute('position')
    let pageModified = false

    if (pages.north) {
      const northPositions = pages.north.geometry.getAttribute('position')
      for (let i = 0; i < TERRAIN_PAGE_SIZE; i++) {
        positions.setY(northRow + i, northPositions.getY(i))
      }
      pageModified = true
    }
    if (pages.west) {
      const westPositions = pages.west.geometry.getAttribute('position')
      for (let i = 0; i < TERRAIN_PAGE_SIZE; i++) {
        positions.setY(
          i * stride + TERRAIN_PAGE_SIZE,
          westPositions.getY(i * stride)
        )
      }
      pageModified = true
    }
    if (pages.south) {
      const southPositions = pages.south.geometry.getAttribute('position')
      for (let i = 0; i < TERRAIN_PAGE_SIZE; i++) {
        southPositions.setY(northRow + i, positions.getY(i))
      }
      southPositions.needsUpdate = true
      pages.south.geometry.computeVertexNormals()
      this.updateTerrainBVH(pages.south)
    }
    if (pages.east) {
      const eastPositions = pages.east.geometry.getAttribute('position')
      for (let i = 0; i < TERRAIN_PAGE_SIZE; i++) {
        eastPositions.setY(
          i * stride + TERRAIN_PAGE_SIZE,
          positions.getY(i * stride)
        )
      }
      eastPositions.needsUpdate = true
      pages.east.geometry.computeVertexNormals()
      this.updateTerrainBVH(pages.east)
    }
    if (pages.northWest) {
      const nwPositions = pages.northWest.geometry.getAttribute('position')
      positions.setY(nwCorner, nwPositions.getY(0))
      pageModified = true
    }
    if (pages.southEast) {
      const sePositions = pages.southEast.geometry.getAttribute('position')
      sePositions.setY(nwCorner, positions.getY(0))
      sePositions.needsUpdate = true
      pages.southEast.geometry.computeVertexNormals()
      this.updateTerrainBVH(pages.southEast)
    }
    if (pageModified) {
      positions.needsUpdate = true
      page.geometry.computeVertexNormals()
    }
    this.updateTerrainBVH(page)
  }

  private setWaterPage(xPage: number, zPage: number) {
    if (this.water == null) {
      // Water is disabled or not ready
      return
    }

    const waterPage = new Group()
    waterPage.name = `${xPage}_${zPage}`
    waterPage.add(
      new Mesh(this.waterTopGeom!, this.waterTopMaterials),
      new Mesh(this.waterBottomGeom!, this.waterBottomMaterials)
    )
    waterPage.position.set(
      xPage * TERRAIN_PAGE_SIZE * 10,
      0,
      zPage * TERRAIN_PAGE_SIZE * 10
    )
    this.water.add(waterPage)
  }

  private refitTerrainBVH(terrainMesh: Mesh) {
    if (terrainMesh == null) {
      return
    }
    const boundsTree = terrainMesh.geometry.boundsTree as MeshBVH | undefined
    if (boundsTree == null) {
      this.updateTerrainBVH(terrainMesh)
      return
    }
    boundsTree.refit()
    if (environment.debug && terrainMesh.userData.bvhHelper != null) {
      terrainMesh.userData.bvhHelper.update()
    }
  }

  private updateTerrainBVH(terrainMesh: Mesh) {
    if (terrainMesh == null) {
      return
    }

    // If the mesh is empty (no faces): we don't need a bounds tree
    if (terrainMesh.geometry.getIndex()!.array.length === 0) {
      terrainMesh.geometry.boundsTree = undefined
      return
    }
    // Force indirect (experimental) to avoid messed up faces
    terrainMesh.geometry.computeBoundsTree({indirect: true} as BVHOptions)
    if (!environment.debug) {
      return
    }
    // Display BVH
    if (terrainMesh.userData.bvhHelper == null) {
      terrainMesh.userData.bvhHelper = new BVHHelper(terrainMesh, 20)
      terrainMesh.parent!.add(terrainMesh.userData.bvhHelper)
    } else {
      terrainMesh.userData.bvhHelper.update()
    }
  }
}
