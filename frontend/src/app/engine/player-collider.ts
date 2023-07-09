import {Vector3, Box3, Ray} from 'three'
import type {Group, Mesh, Object3D, Triangle} from 'three'
import {flattenGroup} from 'three-rwx-loader'
import {MeshBVH} from 'three-mesh-bvh/build/index.module'
import {config} from '../app.config'

const playerHalfSide = config.world.collider.boxSide / 2
const playerClimbHeight = config.world.collider.climbHeight

export class PlayerCollider {
  public boxHeight: number
  public mainBox: Box3
  private topBox: Box3
  private bottomBox: Box3
  private rays: Ray[]
  private currentPos = new Vector3()

  public constructor(boxHeight: number, pos = new Vector3()) {
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

  public static updateObjectBVH(object: Object3D) {
    // Regenerate boundsTree for associated LOD
    this.updateChunkBVH(object.parent as Group)
  }

  public static updateChunkBVH(chunk: Group) {
    // Regenerate boundsTree for associated LOD
    const bvhMesh = flattenGroup(
      chunk,
      (mesh: Mesh) => mesh.userData?.notSolid !== true
    )

    // If the mesh is empty (no faces): we don't need a bounds tree
    if (bvhMesh.geometry.getIndex().array.length === 0) {
      chunk.parent.userData.boundsTree = null
      return
    }
    chunk.parent.userData.boundsTree = new MeshBVH(bvhMesh.geometry, {
      onProgress: (progress: number) => {
        chunk.parent.visible = progress === 1
      }
    })
  }

  public static updateTerrainBVH(terrainMesh: Mesh) {
    if (terrainMesh == null) {
      return
    }

    // If the mesh is empty (no faces): we don't need a bounds tree
    if (terrainMesh.geometry.getIndex().array.length === 0) {
      terrainMesh.userData.boundsTree = null
      return
    }
    terrainMesh.userData.boundsTree = new MeshBVH(terrainMesh.geometry)
  }

  public topBoxIntersectsTriangle(tri: Triangle): boolean {
    return this.topBox.intersectsTriangle(tri)
  }

  public bottomBoxIntersectsTriangle(tri: Triangle): boolean {
    return this.bottomBox.intersectsTriangle(tri)
  }

  public raysIntersectTriangle(tri: Triangle): Vector3 {
    let intersectionPoint: Vector3 = null
    this.rays.forEach((ray) => {
      const point = ray.intersectTriangle(
        tri.a,
        tri.b,
        tri.c,
        true,
        new Vector3()
      )
      if (
        point !== null &&
        (intersectionPoint === null || point.y > intersectionPoint.y)
      ) {
        intersectionPoint = point
      }
    })
    return intersectionPoint
  }

  public checkBoundsTree(
    boundsTree: MeshBVH,
    intersectsTriangle: (_: Triangle) => void
  ): void {
    boundsTree?.shapecast({
      intersectsBounds: (box: Box3) => box.intersectsBox(this.mainBox),
      intersectsTriangle
    })
  }

  public translate(delta: Vector3): void {
    this.mainBox.translate(delta)
    this.topBox.translate(delta)
    this.bottomBox.translate(delta)
    this.rays.forEach((ray) => {
      ray.origin.add(delta)
    })
  }

  public copyPos(pos: Vector3): void {
    const delta = pos.clone().sub(this.currentPos)
    this.translate(delta)
    this.currentPos.copy(pos)
  }
}
