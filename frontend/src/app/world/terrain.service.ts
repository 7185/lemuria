import {Injectable} from '@angular/core'
import {
  Mesh,
  Group,
  PlaneGeometry,
  TextureLoader,
  RepeatWrapping,
  MeshPhongMaterial,
  BufferAttribute,
  SRGBColorSpace
} from 'three'
import {PlayerCollider} from '../engine/player-collider'
import {EngineService} from '../engine/engine.service'

@Injectable({providedIn: 'root'})
export class TerrainService {
  private terrain: Group
  private textureLoader = new TextureLoader()

  constructor(private engineSvc: EngineService) {}
  public setTerrain(world: any) {
    if (this.terrain != null) {
      this.engineSvc.removeWorldObject(this.terrain)
    }
    if (world.terrain) {
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
          terrainMaterials.push(
            new MeshPhongMaterial({map: terrainTexture, shininess: 0})
          )
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
              geometry.addGroup(
                changeTexture,
                k * 6 - changeTexture,
                currTexture
              )
              changeTexture = k * 6
              currTexture = 0
            }
          }

          geometry.setIndex(new BufferAttribute(indices, 1))
          geometry.addGroup(
            changeTexture,
            geometry.getIndex().count,
            currTexture
          )

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
      if (world.terrain_offset != null) {
        this.terrain.position.setY(world.terrain_offset)
      }
      this.engineSvc.addWorldObject(this.terrain)
      this.terrain.updateMatrixWorld()
      PlayerCollider.updateTerrainBVH(this.terrain)
    } else {
      this.terrain = null
    }
  }
}
