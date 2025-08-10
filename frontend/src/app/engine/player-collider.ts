import type {Triangle} from 'three'
import {
  Box3,
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Ray,
  Vector3
} from 'three'
import {flattenGroup} from 'three-rwx-loader'
import type {MeshBVH} from 'three-mesh-bvh'
import {environment} from '../../environments/environment'

const playerBoxSide = environment.world.collider.boxSide
const playerHalfSide = environment.world.collider.boxSide / 2
const playerClimbHeight = environment.world.collider.climbHeight

export class PlayerCollider {
  boxHeight: number
  mainBox: Box3
  topBox: Box3
  bottomBox: Box3
  colliderBox: Group
  boxMaterial = new MeshBasicMaterial({
    color: 0x00ff00,
    wireframe: true
  })

  private rays: Ray[]
  private currentPos = new Vector3()

  private tmpIntersect = new Vector3()
  private tmpBestIntersect = new Vector3()

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

  createBoundingBox(boxHeight: number, position: Vector3) {
    const boundingBox = new Group()
    boundingBox.name = 'boundingBox'
    const mainBoxGeometry = new BoxGeometry(
      playerBoxSide,
      boxHeight,
      playerBoxSide
    )
    const topBoxGeometry = new BoxGeometry(
      playerBoxSide,
      boxHeight - playerClimbHeight,
      playerBoxSide
    )
    const bottomBoxGeometry = new BoxGeometry(
      playerBoxSide,
      playerClimbHeight,
      playerBoxSide
    )
    const materials = Array(6).fill(this.boxMaterial)
    const mainBox = new Mesh(mainBoxGeometry, materials)
    const topBox = new Mesh(topBoxGeometry, materials)
    const bottomBox = new Mesh(bottomBoxGeometry, materials)

    topBox.position.set(0, (boxHeight - (boxHeight - playerClimbHeight)) / 2, 0)
    bottomBox.position.set(0, (playerClimbHeight - boxHeight) / 2, 0)
    boundingBox.add(mainBox, topBox, bottomBox)
    boundingBox.position.set(position.x, position.y + boxHeight / 2, position.z)
    boundingBox.userData.mainBox = mainBox
    boundingBox.userData.topBox = topBox
    boundingBox.userData.bottomBox = bottomBox
    this.colliderBox = boundingBox
  }

  raysIntersectTriangle(tri: Triangle): Vector3 {
    let hasIntersection = false
    this.rays.forEach((ray) => {
      // If intersection occurs, result is stored in tmpIntersect
      if (
        ray.intersectTriangle(tri.a, tri.b, tri.c, true, this.tmpIntersect) &&
        (!hasIntersection || this.tmpIntersect.y > this.tmpBestIntersect.y)
      ) {
        // Copy into cached "best" vector
        this.tmpBestIntersect.copy(this.tmpIntersect)
        hasIntersection = true
      }
    })
    // Critical to only return the best intersect if the intersection
    // actually happened during this call
    return hasIntersection ? this.tmpBestIntersect : null
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
    this.translate(this.currentPos.subVectors(pos, this.currentPos))
    this.currentPos.copy(pos)
  }
}
