import type {Triangle} from 'three'
import type {MeshBVH} from 'three-mesh-bvh'
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
import {environment} from '../../environments/environment'

const playerBoxSide = environment.world.collider.boxSide
const playerHalfSide = environment.world.collider.boxSide / 2
const playerClimbHeight = environment.world.collider.climbHeight

export class PlayerCollider {
  boxHeight: number
  colliderBox: Group
  boxMaterial = new MeshBasicMaterial({
    color: 0x00ff00,
    wireframe: true
  })

  boxCollision = false
  feetCollision = false
  climbHeight: number | null = null

  private mainBox = new Box3()
  private topBox = new Box3()
  private bottomBox = new Box3()
  private rays: Ray[]
  private currentPos = new Vector3()
  private stepPosY = 0
  private currentOffsetY = 0

  private tmpLocalPos = new Vector3()
  private tmpIntersect = new Vector3()
  private tmpBestIntersect = new Vector3()

  private readonly shapecastCallbacks = {
    intersectsBounds: (box: Box3) => box.intersectsBox(this.mainBox),
    intersectsTriangle: (tri: Triangle) => {
      if (this.topBox.intersectsTriangle(tri)) {
        this.boxCollision = true
        this.boxMaterial.color.setHex(0xff0000)
      }

      if (this.bottomBox.intersectsTriangle(tri)) {
        this.feetCollision = true
      }

      const rayHit = this.raysIntersectTriangle(tri)
      if (rayHit != null) {
        const worldY = rayHit.y + this.currentOffsetY
        if (worldY > this.stepPosY) {
          if (!this.boxCollision) {
            this.boxMaterial.color.setHex(0xffff00)
          }
          if (this.climbHeight == null || this.climbHeight < worldY) {
            this.climbHeight = worldY
          }
        }
      }
    }
  }

  constructor(boxHeight: number, pos = new Vector3()) {
    // We need to ensure the total collider height doesn't go too low
    this.boxHeight = Math.max(boxHeight, playerClimbHeight + 0.1)

    const downward = new Vector3(0, -1, 0)
    this.rays = [
      new Ray(new Vector3(), downward),
      new Ray(new Vector3(), downward),
      new Ray(new Vector3(), downward),
      new Ray(new Vector3(), downward),
      new Ray(new Vector3(), downward)
    ]
    this.copyPos(pos)
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

  resetStep(pos: Vector3): void {
    this.currentPos.copy(pos)
    this.stepPosY = pos.y
    this.boxCollision = false
    this.feetCollision = false
    this.climbHeight = null
    this.boxMaterial.color.setHex(0x00ff00)
  }

  testBoundsTree(
    boundsTree: MeshBVH | null | undefined,
    offset: Vector3
  ): void {
    if (boundsTree == null) {
      return
    }
    this.currentOffsetY = offset.y
    this.tmpLocalPos.subVectors(this.currentPos, offset)
    this.setBoxesAt(this.tmpLocalPos)
    boundsTree.shapecast(this.shapecastCallbacks)
  }

  copyPos(pos: Vector3): void {
    this.currentPos.copy(pos)
    this.setBoxesAt(this.currentPos)
  }

  private setBoxesAt(pos: Vector3): void {
    const minX = pos.x - playerHalfSide
    const maxX = pos.x + playerHalfSide
    const minZ = pos.z - playerHalfSide
    const maxZ = pos.z + playerHalfSide
    const topY = pos.y + this.boxHeight
    const climbY = pos.y + playerClimbHeight

    this.mainBox.min.set(minX, pos.y, minZ)
    this.mainBox.max.set(maxX, topY, maxZ)
    this.topBox.min.set(minX, climbY, minZ)
    this.topBox.max.set(maxX, topY, maxZ)
    this.bottomBox.min.set(minX, pos.y, minZ)
    this.bottomBox.max.set(maxX, climbY, maxZ)

    this.rays[0].origin.set(pos.x, topY, pos.z)
    this.rays[1].origin.set(minX, topY, minZ)
    this.rays[2].origin.set(minX, topY, maxZ)
    this.rays[3].origin.set(maxX, topY, maxZ)
    this.rays[4].origin.set(maxX, topY, minZ)
  }

  private raysIntersectTriangle(tri: Triangle): Vector3 | null {
    let hasIntersection = false
    for (const ray of this.rays) {
      // If intersection occurs, result is stored in tmpIntersect
      if (
        ray.intersectTriangle(tri.a, tri.b, tri.c, true, this.tmpIntersect) &&
        (!hasIntersection || this.tmpIntersect.y > this.tmpBestIntersect.y)
      ) {
        // Copy into cached "best" vector
        this.tmpBestIntersect.copy(this.tmpIntersect)
        hasIntersection = true
      }
    }
    // Critical to only return the best intersect if the intersection
    // actually happened during this call
    return hasIntersection ? this.tmpBestIntersect : null
  }
}
