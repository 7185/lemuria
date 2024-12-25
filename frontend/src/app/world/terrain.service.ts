import {inject, Injectable} from '@angular/core'
import {
  BufferAttribute,
  CanvasTexture,
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
import type {Observable} from 'rxjs'
import {from, map, forkJoin} from 'rxjs'
import {PlayerCollider} from '../engine/player-collider'
import {EngineService} from '../engine/engine.service'
import {PropService} from './prop.service'
import {HttpService} from '../network'
import {TERRAIN_PAGE_SIZE} from '../utils/constants'
import {rgbToHex} from '../utils/utils'

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
@Injectable({providedIn: 'root'})
export class TerrainService {
  terrain: Group | null = null
  water: Group | null = null
  private readonly engineSvc = inject(EngineService)
  private readonly http = inject(HttpService)
  private readonly propSvc = inject(PropService)
  private textureLoader = new ImageBitmapLoader().setOptions({
    imageOrientation: 'flipY'
  })
  private terrainMaterials: MeshLambertMaterial[] = []
  private waterBottomGeom: PlaneGeometry | null = null
  private waterTopGeom: PlaneGeometry | null = null
  private waterBottomMaterials: MeshLambertMaterial[] = []
  private waterTopMaterials: MeshLambertMaterial[] = []
  private worldId = 0
  private loadingPages = new Set()

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
      TERRAIN_PAGE_SIZE * 10,
      TERRAIN_PAGE_SIZE,
      TERRAIN_PAGE_SIZE
    )
    this.waterTopGeom.rotateX(-Math.PI / 2)
    this.waterTopGeom.addGroup(0, this.waterTopGeom.getIndex()!.count, 0)
    this.waterBottomGeom = new PlaneGeometry(
      TERRAIN_PAGE_SIZE * 10,
      TERRAIN_PAGE_SIZE * 10,
      TERRAIN_PAGE_SIZE,
      TERRAIN_PAGE_SIZE
    )
    this.waterBottomGeom.rotateX(Math.PI / 2)
    this.waterBottomGeom.addGroup(0, this.waterBottomGeom.getIndex()!.count, 0)

    const waterMaterialBottom = new MeshLambertMaterial({
      transparent: true,
      color: new Color(this.water.userData.color),
      opacity: this.water.userData.opacity / 255
    })

    const waterMaterialTop = new MeshLambertMaterial({
      transparent: true,
      color: new Color(this.water.userData.color),
      opacity: this.water.userData.opacity / 255
    })

    if (water?.texture_bottom) {
      this.textureLoader.load(
        `${this.propSvc.path()}/textures/${water.texture_bottom}.jpg`,
        (texture) => {
          const bottomTexture = new CanvasTexture(
            texture,
            Texture.DEFAULT_MAPPING,
            RepeatWrapping,
            RepeatWrapping
          )
          bottomTexture.colorSpace = SRGBColorSpace
          bottomTexture.repeat.set(TERRAIN_PAGE_SIZE, TERRAIN_PAGE_SIZE)
          waterMaterialBottom.map = bottomTexture
          this.waterBottomMaterials = [waterMaterialBottom]
        }
      )
    }

    if (water?.texture_top) {
      this.textureLoader.load(
        `${this.propSvc.path()}/textures/${water.texture_top}.jpg`,
        (texture) => {
          const topTexture = new CanvasTexture(
            texture,
            Texture.DEFAULT_MAPPING,
            RepeatWrapping,
            RepeatWrapping
          )
          topTexture.colorSpace = SRGBColorSpace
          topTexture.repeat.set(TERRAIN_PAGE_SIZE, TERRAIN_PAGE_SIZE)
          waterMaterialTop.map = topTexture
          this.waterTopMaterials = [waterMaterialTop]
        }
      )
    }

    if (water?.offset != null) {
      this.water.position.setY(water.offset)
    }
    this.engineSvc.addWorldObject(this.water)
  }

  setTerrain(terrain: TerrainData | null = null, worldId: number) {
    this.worldId = worldId
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
          map((texture) => {
            const baseTexture = new CanvasTexture(
              texture,
              Texture.DEFAULT_MAPPING,
              RepeatWrapping,
              RepeatWrapping
            )
            baseTexture.colorSpace = SRGBColorSpace
            baseTexture.repeat.set(TERRAIN_PAGE_SIZE, TERRAIN_PAGE_SIZE)
            return baseTexture
          })
        )
      )
    }

    forkJoin(textureObservables).subscribe((baseTextures) => {
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 64; j++) {
          const terrainTexture = j < 63 ? baseTextures[j].clone() : null
          if (terrainTexture) {
            terrainTexture.rotation = (i * Math.PI) / 2
          }
          this.terrainMaterials.push(
            new MeshLambertMaterial({map: terrainTexture})
          )
        }
      }

      if (terrain?.offset != null) {
        this.terrain.position.setY(terrain.offset)
      }
      this.engineSvc.addWorldObject(this.terrain)
      this.terrain.updateMatrixWorld()
    })
  }

  getTerrainPages(playerX: number, playerZ: number, radius: number) {
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
        this.setTerrainPage(page[0], page[1])
      }
      if (
        !this.water?.children?.find(
          (m) => m.name === `${page[0]}_${page[1]}`
        ) &&
        !this.loadingPages.has(`${page[0]}_${page[1]}`)
      ) {
        this.setWaterPage(page[0], page[1])
      }
    })
  }

  private setTerrainPage(xPage: number, zPage: number) {
    if (this.terrain == null) {
      // Terrain is disabled or not ready
      return
    }

    this.loadingPages.add(`${xPage}_${zPage}`)

    this.http.terrain(this.worldId, xPage, zPage).subscribe((elevData) => {
      const geometry = new PlaneGeometry(
        TERRAIN_PAGE_SIZE * 10,
        TERRAIN_PAGE_SIZE * 10,
        TERRAIN_PAGE_SIZE,
        TERRAIN_PAGE_SIZE
      )
      geometry.rotateX(-Math.PI / 2)

      const positions = new Float32Array(
        (geometry.getAttribute('position') as BufferAttribute).array
      )
      let gap = 0
      for (let i = 0, j = 0; i < positions.length; i++, j += 3) {
        if (i % TERRAIN_PAGE_SIZE == 0) {
          // skip edge
          gap++
        }
        positions[j - 2 + gap * 3] = elevData[i]?.[1] / 100 || 0
      }
      geometry.setAttribute('position', new BufferAttribute(positions, 3))

      const indices = new Uint16Array(geometry.getIndex()!.array)
      let changeTexture = 0
      let currTexture = 0
      for (let k = 0; k < TERRAIN_PAGE_SIZE * TERRAIN_PAGE_SIZE; k++) {
        const newTexture = elevData[k] != null ? elevData[k][0] : 0

        if (elevData[k] != null && elevData[k][0] === 254) {
          // Empty cell
          indices.fill(0, k * 6, k * 6 + 6)
          continue
        }
        if (newTexture !== currTexture) {
          geometry.addGroup(changeTexture, k * 6 - changeTexture, currTexture)
          changeTexture = k * 6
          currTexture = newTexture
        }
      }

      geometry.setIndex(new BufferAttribute(indices, 1))
      geometry.addGroup(
        changeTexture,
        geometry.getIndex()!.count - changeTexture,
        currTexture
      )
      geometry.computeVertexNormals()

      const terrainMesh = new Mesh(geometry, this.terrainMaterials)
      terrainMesh.name = `${xPage}_${zPage}`
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

  private getPage(xPage: number, zPage: number) {
    return this.terrain!.getObjectByName(`${xPage}_${zPage}`) as Mesh
  }

  private getPosAndIndex(page: Mesh) {
    return [page.geometry.getAttribute('position'), page.geometry.getIndex()!]
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

    const lastFaceIndex = TERRAIN_PAGE_SIZE * TERRAIN_PAGE_SIZE * 2 - 1
    const [positions, indices] = this.getPosAndIndex(page)

    if (pages.north) {
      const [northPositions, northIndices] = this.getPosAndIndex(pages.north)
      // Get north page's south
      const south = Array.from({length: TERRAIN_PAGE_SIZE}, (_, i) =>
        northPositions.getY(northIndices.getX(i * 2 * 3))
      )
      // Update current page's north
      let southIndex = 0
      for (
        let i = (TERRAIN_PAGE_SIZE * TERRAIN_PAGE_SIZE - TERRAIN_PAGE_SIZE) * 2;
        i < TERRAIN_PAGE_SIZE * TERRAIN_PAGE_SIZE * 2;
        i += 2
      ) {
        positions.setY(indices.getY(i * 3), south[southIndex])
        southIndex++
      }
      positions.needsUpdate = true
      page.geometry.computeVertexNormals()
    }
    if (pages.west) {
      const [westPositions, westIndices] = this.getPosAndIndex(pages.west)
      // Get west page's east
      const east = Array.from({length: TERRAIN_PAGE_SIZE}, (_, i) =>
        westPositions.getY(westIndices.getX(i * TERRAIN_PAGE_SIZE * 2 * 3))
      )
      // Update current page's west
      let eastIndex = 0
      for (
        let i = (TERRAIN_PAGE_SIZE - 1) * 2;
        i < TERRAIN_PAGE_SIZE * TERRAIN_PAGE_SIZE * 2;
        i += TERRAIN_PAGE_SIZE * 2
      ) {
        positions.setY(indices.getZ(i * 3), east[eastIndex])
        eastIndex++
      }
      positions.needsUpdate = true
      page.geometry.computeVertexNormals()
    }
    if (pages.south) {
      const [southPositions, southIndices] = this.getPosAndIndex(pages.south)
      // Get current south
      const south = Array.from({length: TERRAIN_PAGE_SIZE}, (_, i) =>
        positions.getY(indices.getX(i * 2 * 3))
      )
      // Update south page's north
      let southIndex = 0
      for (
        let i = (TERRAIN_PAGE_SIZE * TERRAIN_PAGE_SIZE - TERRAIN_PAGE_SIZE) * 2;
        i < TERRAIN_PAGE_SIZE * TERRAIN_PAGE_SIZE * 2;
        i += 2
      ) {
        southPositions.setY(southIndices.getY(i * 3), south[southIndex])
        southIndex++
      }
      southPositions.needsUpdate = true
      pages.south.geometry.computeVertexNormals()
      PlayerCollider.updateTerrainBVH(pages.south)
    }
    if (pages.east) {
      const [eastPositions, eastIndices] = this.getPosAndIndex(pages.east)
      // Get current east
      const east = Array.from({length: TERRAIN_PAGE_SIZE}, (_, i) =>
        positions.getY(indices.getX(i * TERRAIN_PAGE_SIZE * 2 * 3))
      )
      // Update east page's west
      let eastIndex = 0
      for (
        let i = (TERRAIN_PAGE_SIZE - 1) * 2;
        i < TERRAIN_PAGE_SIZE * TERRAIN_PAGE_SIZE * 2;
        i += TERRAIN_PAGE_SIZE * 2
      ) {
        eastPositions.setY(eastIndices.getZ(i * 3), east[eastIndex])
        eastIndex++
      }
      eastPositions.needsUpdate = true
      pages.east.geometry.computeVertexNormals()
      PlayerCollider.updateTerrainBVH(pages.east)
    }
    if (pages.northWest) {
      // We can fix current north-west corner
      const [nwPositions, nwIndices] = this.getPosAndIndex(pages.northWest)
      // Get north west page's south east corner (0 = first face)
      const seCorner = nwPositions.getY(nwIndices.getX(0))
      // Set corner
      positions.setY(indices.getY(lastFaceIndex * 3), seCorner)
      positions.needsUpdate = true
      page.geometry.computeVertexNormals()
    }
    if (pages.southEast) {
      // We can fix south-east page's north-west corner
      const [sePositions, seIndices] = this.getPosAndIndex(pages.southEast)
      // Get current south east corner (0 = first face)
      const seCorner = positions.getY(indices.getX(0))
      // Set corner
      sePositions.setY(seIndices.getY(lastFaceIndex * 3), seCorner)
      sePositions.needsUpdate = true
      pages.southEast.geometry.computeVertexNormals()
      PlayerCollider.updateTerrainBVH(pages.southEast)
    }
    PlayerCollider.updateTerrainBVH(page)
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
}
