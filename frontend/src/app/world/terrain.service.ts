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
import {EngineService} from '../engine/engine.service'
import {Utils} from '../utils'

@Injectable({providedIn: 'root'})
export class TerrainService {
  private terrain: Group
  private water: Group
  private textureLoader = new TextureLoader()

  constructor(private engineSvc: EngineService) {}

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

    const geometryTop = new PlaneGeometry(1280, 1280, 128, 128)
    geometryTop.rotateX(-Math.PI / 2)
    geometryTop.addGroup(0, geometryTop.getIndex().count, 0)
    const geometryBottom = new PlaneGeometry(1280, 1280, 128, 128)
    geometryBottom.rotateX(Math.PI / 2)
    geometryBottom.addGroup(0, geometryBottom.getIndex().count, 0)

    this.water.userData.color = Utils.rgbToHex(
      ...((world?.water?.color || [0, 255, 255]) as [number, number, number])
    )

    const waterMaterialTop = new MeshLambertMaterial({
      transparent: true,
      color: new Color(this.water.userData.color),
      opacity: (world?.water?.opacity || 128) / 255
    })
    const waterMaterialBottom = new MeshLambertMaterial({
      transparent: true,
      color: new Color(this.water.userData.color),
      opacity: (world?.water?.opacity || 128) / 255
    })

    if (world.water?.texture_top) {
      const topTexture = this.textureLoader.load(
        `${world.path}/textures/${world.water.texture_top}.jpg`
      )
      topTexture.colorSpace = SRGBColorSpace
      topTexture.wrapS = RepeatWrapping
      topTexture.wrapT = RepeatWrapping
      topTexture.repeat.set(128, 128)
      waterMaterialTop.map = topTexture
    }

    if (world.water?.texture_bottom) {
      const bottomTexture = this.textureLoader.load(
        `${world.path}/textures/${world.water.texture_bottom}.jpg`
      )
      bottomTexture.colorSpace = SRGBColorSpace
      bottomTexture.wrapS = RepeatWrapping
      bottomTexture.wrapT = RepeatWrapping
      bottomTexture.repeat.set(128, 128)
      waterMaterialBottom.map = bottomTexture
    }

    const waterMeshTop = new Mesh(geometryTop, [waterMaterialTop])
    const waterMeshBottom = new Mesh(geometryBottom, [waterMaterialBottom])
    this.water.add(waterMeshTop)
    this.water.add(waterMeshBottom)

    if (world.water?.offset != null) {
      this.water.position.setY(world.water.offset)
    }
    this.engineSvc.addWorldObject(this.water)
  }

  public setTerrain(world: any) {
    if (this.terrain != null) {
      this.engineSvc.removeWorldObject(this.terrain)
    }
    if (!world.terrain.enabled) {
      this.terrain = null
      return
    }

    this.terrain = new Group()
    this.terrain.name = 'terrain'
    const terrainMaterials = []

    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 64; j++) {
        const terrainTexture = this.textureLoader.load(
          `${world.path}/textures/terrain${j}.jpg`
        )
        terrainTexture.colorSpace = SRGBColorSpace
        terrainTexture.wrapS = RepeatWrapping
        terrainTexture.wrapT = RepeatWrapping
        terrainTexture.rotation = (i * Math.PI) / 2
        terrainTexture.repeat.set(128, 128)
        terrainMaterials.push(new MeshLambertMaterial({map: terrainTexture}))
      }
    }

    if (world.elev != null) {
      for (const [page, elevData] of Object.entries(world.elev)) {
        const geometry = new PlaneGeometry(1280, 1280, 128, 128)
        geometry.rotateX(-Math.PI / 2)

        const positions = new Float32Array(
          (geometry.getAttribute('position') as BufferAttribute).array
        )
        let gap = 0
        for (let i = 0, j = 0; i < positions.length; i++, j += 3) {
          if (i % 128 == 0) {
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
        for (let k = 0; k < 128 * 128; k++) {
          if (elevData[k] != null) {
            if (elevData[k][0] === 254) {
              // Empty cell
              indices.fill(0, k * 6, k * 6 + 6)
              continue
            }
            if (elevData[k][0] !== currTexture) {
              geometry.addGroup(
                changeTexture,
                k * 6 - changeTexture,
                currTexture
              )
              changeTexture = k * 6
              currTexture = elevData[k][0]
            }
          } else if (currTexture !== 0) {
            geometry.addGroup(changeTexture, k * 6 - changeTexture, currTexture)
            changeTexture = k * 6
            currTexture = 0
          }
        }

        geometry.setIndex(new BufferAttribute(indices, 1))
        geometry.addGroup(changeTexture, geometry.getIndex().count, currTexture)

        const terrainMesh = new Mesh(geometry, terrainMaterials)
        const pos = page.split('_').map((p) => parseInt(p, 10))
        terrainMesh.position.set(pos[0] * 10, 0, pos[1] * 10)
        this.terrain.add(terrainMesh)
      }
    } else {
      const geometry = new PlaneGeometry(1280, 1280, 128, 128)
      geometry.rotateX(-Math.PI / 2)
      geometry.addGroup(0, geometry.getIndex().count, 0)
      const terrainMesh = new Mesh(geometry, terrainMaterials)
      this.terrain.add(terrainMesh)
    }
    if (world.terrain?.offset != null) {
      this.terrain.position.setY(world.terrain.offset)
    }
    this.engineSvc.addWorldObject(this.terrain)
    this.terrain.updateMatrixWorld()
    PlayerCollider.updateTerrainBVH(this.terrain)
  }
}
