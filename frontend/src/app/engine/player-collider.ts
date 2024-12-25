import {Box3, Ray, Vector3} from 'three'
import type {Group, Mesh, Triangle} from 'three'
import {flattenGroup} from 'three-rwx-loader'
import {MeshBVHHelper} from 'three-mesh-bvh'
import type {MeshBVH, MeshBVHOptions} from 'three-mesh-bvh'
import {environment} from '../../environments/environment'

const playerHalfSide = environment.world.collider.boxSide / 2
const playerClimbHeight = environment.world.collider.climbHeight

export class PlayerCollider {
  boxHeight: number
  mainBox: Box3
  private topBox: Box3
  private bottomBox: Box3
  private rays: Ray[]
  private currentPos = new Vector3()

  constructor(boxHeight: number, pos = new Vector3()) {
    // We need to ensure the total collider height doesn't go too low
    this.boxHeight = Math.max(boxHeight, playerClimbHeight + 0.1)

    this.mainBox = new Box3(
      new Vector3(-playerHalfSide, 0, -playerHalfSide),
      new Vector3(playerHalfSide, this.boxHeight, playerHalfSide)
    )
    this.topBox = new Box3(
      new Vector3(-playerHalfSide, playerClimbHeight, -playerHalfSide),
      new Vector3(playerHalfSide, this.boxHeight, playerHalfSide)
    )
    this.bottomBox = new Box3(
      new Vector3(-playerHalfSide, 0, -playerHalfSide),
      new Vector3(playerHalfSide, playerClimbHeight, playerHalfSide)
    )
    const downward = new Vector3(0, -1, 0)
    this.rays = [
      new Ray(new Vector3(0, this.boxHeight, 0), new Vector3(0, -1, 0)),
      new Ray(
        new Vector3(-playerHalfSide, this.boxHeight, -playerHalfSide),
        downward
      ),
      new Ray(
        new Vector3(-playerHalfSide, this.boxHeight, playerHalfSide),
        downward
      ),
      new Ray(
        new Vector3(playerHalfSide, this.boxHeight, playerHalfSide),
        downward
      ),
      new Ray(
        new Vector3(playerHalfSide, this.boxHeight, -playerHalfSide),
        downward
      )
    ]
    this.currentPos.copy(pos)

    this.translate(this.currentPos)
  }

  static updateChunkBVH(chunk: Group) {
    // Regenerate boundsTree for associated LOD
    const bvhMesh = flattenGroup(
      chunk,
      (mesh: Mesh) => mesh.userData?.notSolid !== true
    ) as Mesh

    // If the mesh is empty (no faces): we don't need a bounds tree
    if (bvhMesh.geometry.getIndex()!.count === 0) {
      chunk.parent!.userData.boundsTree = null
      chunk.parent!.visible = true
      return
    }
    chunk.parent!.userData.boundsTree = bvhMesh.geometry.computeBoundsTree({
      onProgress: (progress: number) => {
        chunk.parent!.visible = progress === 1
      }
    })
  }

  static updateTerrainBVH(terrainMesh: Mesh) {
    if (terrainMesh == null) {
      return
    }

    // If the mesh is empty (no faces): we don't need a bounds tree
    if (terrainMesh.geometry.getIndex()!.array.length === 0) {
      terrainMesh.geometry.boundsTree = undefined
      return
    }
    // Force indirect (experimental) to avoid messed up faces
    terrainMesh.geometry.computeBoundsTree({indirect: true} as MeshBVHOptions)
    if (!environment.debug) {
      return
    }
    // Display BVH
    if (terrainMesh.userData.bvhHelper != null) {
      terrainMesh.userData.bvhHelper.update()
    } else {
      terrainMesh.userData.bvhHelper = new MeshBVHHelper(terrainMesh, 20)
      terrainMesh.parent!.add(terrainMesh.userData.bvhHelper)
    }
  }

  topBoxIntersectsTriangle(tri: Triangle): boolean {
    return this.topBox.intersectsTriangle(tri)
  }

  bottomBoxIntersectsTriangle(tri: Triangle): boolean {
    return this.bottomBox.intersectsTriangle(tri)
  }

  raysIntersectTriangle(tri: Triangle): Vector3 {
    let intersectionPoint: Vector3 = null
    this.rays.forEach((ray) => {
      const point = ray.intersectTriangle(
        tri.a,
        tri.b,
        tri.c,
        true,
        new Vector3()
      )
      if (intersectionPoint === null || point?.y > intersectionPoint.y) {
        intersectionPoint = point
      }
    })
    return intersectionPoint
  }

  checkBoundsTree(
    boundsTree: MeshBVH,
    intersectsTriangle: (_: Triangle) => void
  ): void {
    boundsTree?.shapecast({
      intersectsBounds: (box: Box3) => box.intersectsBox(this.mainBox),
      intersectsTriangle
    })
  }

  translate(delta: Vector3): void {
    this.mainBox.translate(delta)
    this.topBox.translate(delta)
    this.bottomBox.translate(delta)
    this.rays.forEach((ray) => {
      ray.origin.add(delta)
    })
  }

  copyPos(pos: Vector3): void {
    const delta = pos.clone().sub(this.currentPos)
    this.translate(delta)
    this.currentPos.copy(pos)
  }
}
