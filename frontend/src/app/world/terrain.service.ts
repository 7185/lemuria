import {Injectable} from '@angular/core'
import {
  BufferAttribute,
  Color,
  Mesh,
  Group,
  MeshLambertMaterial,
  PlaneGeometry,
  RepeatWrapping,
  SRGBColorSpace,
  TextureLoader
} from 'three'
import {PlayerCollider} from '../engine/player-collider'
import {EngineService, TERRAIN_PAGE_SIZE} from '../engine/engine.service'
import {HttpService} from '../network'
import {Utils} from '../utils'

@Injectable({providedIn: 'root'})
export class TerrainService {
  private terrain: Group
  private water: Group
  private textureLoader = new TextureLoader()
  private terrainMaterials = []
  private waterBottomMaterials = []
  private waterTopMaterials = []
  private worldId = 0
  private loadingPages = new Set()

  constructor(
    private engineSvc: EngineService,
    private httpSvc: HttpService
  ) {}

  public setWater(world: any) {
    if (this.water != null) {
      this.engineSvc.removeWorldObject(this.water)
    }
    if (!world.water.enabled) {
      this.water = null
      return
    }
    this.water = new Group()
    this.water.name = 'water'

    this.water.userData.color = Utils.rgbToHex(
      ...((world?.water?.color || [0, 255, 255]) as [number, number, number])
    )

    const waterMaterialBottom = new MeshLambertMaterial({
      transparent: true,
      color: new Color(this.water.userData.color),
      opacity: (world?.water?.opacity || 128) / 255
    })

    const waterMaterialTop = new MeshLambertMaterial({
      transparent: true,
      color: new Color(this.water.userData.color),
      opacity: (world?.water?.opacity || 128) / 255
    })

    if (world.water?.texture_bottom) {
      const bottomTexture = this.textureLoader.load(
        `${world.path}/textures/${world.water.texture_bottom}.jpg`
      )
      bottomTexture.colorSpace = SRGBColorSpace
      bottomTexture.wrapS = RepeatWrapping
      bottomTexture.wrapT = RepeatWrapping
      bottomTexture.repeat.set(TERRAIN_PAGE_SIZE, TERRAIN_PAGE_SIZE)
      waterMaterialBottom.map = bottomTexture
    }

    if (world.water?.texture_top) {
      const topTexture = this.textureLoader.load(
        `${world.path}/textures/${world.water.texture_top}.jpg`
      )
      topTexture.colorSpace = SRGBColorSpace
      topTexture.wrapS = RepeatWrapping
      topTexture.wrapT = RepeatWrapping
      topTexture.repeat.set(TERRAIN_PAGE_SIZE, TERRAIN_PAGE_SIZE)
      waterMaterialTop.map = topTexture
    }

    this.waterBottomMaterials = [waterMaterialBottom]
    this.waterTopMaterials = [waterMaterialTop]

    if (world.water?.offset != null) {
      this.water.position.setY(world.water.offset)
    }
    this.engineSvc.addWorldObject(this.water)
  }

  public setTerrain(world: any) {
    this.worldId = world.id
    if (this.terrain != null) {
      this.engineSvc.removeWorldObject(this.terrain)
    }
    if (!world.terrain.enabled) {
      this.terrain = null
      return
    }

    this.terrain = new Group()
    this.terrain.name = 'terrain'
    this.terrainMaterials = []

    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 64; j++) {
        const terrainTexture = this.textureLoader.load(
          `${world.path}/textures/terrain${j}.jpg`
        )
        terrainTexture.colorSpace = SRGBColorSpace
        terrainTexture.wrapS = RepeatWrapping
        terrainTexture.wrapT = RepeatWrapping
        terrainTexture.rotation = (i * Math.PI) / 2
        terrainTexture.repeat.set(TERRAIN_PAGE_SIZE, TERRAIN_PAGE_SIZE)
        this.terrainMaterials.push(
          new MeshLambertMaterial({map: terrainTexture})
        )
      }
    }
    if (world.terrain?.offset != null) {
      this.terrain.position.setY(world.terrain.offset)
    }
    this.engineSvc.addWorldObject(this.terrain)
    this.terrain.updateMatrixWorld()
  }

  public getTerrainPages(playerX: number, playerZ: number, radius: number) {
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

    this.httpSvc.terrain(this.worldId, xPage, zPage).subscribe((elevData) => {
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

      const indices = new Uint16Array(
        (geometry.getIndex() as BufferAttribute).array
      )
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
        geometry.getIndex().count - changeTexture,
        currTexture
      )

      const terrainMesh = new Mesh(geometry, this.terrainMaterials)
      terrainMesh.name = `${xPage}_${zPage}`
      terrainMesh.position.set(
        xPage * TERRAIN_PAGE_SIZE * 10,
        0,
        zPage * TERRAIN_PAGE_SIZE * 10
      )
      PlayerCollider.updateTerrainBVH(terrainMesh)
      this.terrain.add(terrainMesh)
      this.loadingPages.delete(`${xPage}_${zPage}`)
    })
  }

  private setWaterPage(xPage: number, zPage: number) {
    if (this.water == null) {
      // Water is disabled or not ready
      return
    }

    const geometryTop = new PlaneGeometry(
      TERRAIN_PAGE_SIZE * 10,
      TERRAIN_PAGE_SIZE * 10,
      TERRAIN_PAGE_SIZE,
      TERRAIN_PAGE_SIZE
    )
    geometryTop.rotateX(-Math.PI / 2)
    geometryTop.addGroup(0, geometryTop.getIndex().count, 0)
    const geometryBottom = new PlaneGeometry(
      TERRAIN_PAGE_SIZE * 10,
      TERRAIN_PAGE_SIZE * 10,
      TERRAIN_PAGE_SIZE,
      TERRAIN_PAGE_SIZE
    )
    geometryBottom.rotateX(Math.PI / 2)
    geometryBottom.addGroup(0, geometryBottom.getIndex().count, 0)

    const waterMeshTop = new Mesh(geometryTop, this.waterTopMaterials)
    const waterMeshBottom = new Mesh(geometryBottom, this.waterBottomMaterials)
    waterMeshTop.position.set(
      xPage * TERRAIN_PAGE_SIZE * 10,
      0,
      zPage * TERRAIN_PAGE_SIZE * 10
    )
    waterMeshBottom.position.set(
      xPage * TERRAIN_PAGE_SIZE * 10,
      0,
      zPage * TERRAIN_PAGE_SIZE * 10
    )
    this.water.add(waterMeshTop)
    this.water.add(waterMeshBottom)
  }
}
