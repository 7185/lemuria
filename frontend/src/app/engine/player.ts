import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Vector3
} from 'three'
import type {LOD, Triangle} from 'three'
import {PlayerCollider} from './player-collider'
import {DEG, TERRAIN_PAGE_SIZE, Utils} from '../utils'
import {environment} from '../../environments/environment'
import {inject, signal} from '@angular/core'
import type {AvatarAnimationPlayer} from '../animation'
import {InputSystemService} from './inputsystem.service'

export class Player {
  static readonly BOX_SIDE = environment.world.collider.boxSide
  static readonly CLIMB_HEIGHT = environment.world.collider.climbHeight
  static readonly GROUND_ADJUST = environment.world.collider.groundAdjust
  static readonly MAX_STEP_LENGTH = environment.world.collider.maxStepLength
  static readonly MAX_NB_STEPS = environment.world.collider.maxNbSteps

  private readonly inputSysSvc = inject(InputSystemService)

  avatar: Group
  state = 'idle'
  gesture: string | null = null
  isFlying = false
  isOnFloor = true
  inWater = signal(false)
  collider: PlayerCollider
  colliderBox: Group
  entity: Object3D
  velocity = new Vector3()
  private boxMaterial = new MeshBasicMaterial({
    color: 0x00ff00,
    wireframe: true
  })

  constructor() {
    this.entity = new Object3D()
    this.entity.rotation.order = 'YXZ'
    this.avatar = new Group()
    this.avatar.name = 'avatar'
    this.entity.attach(this.avatar)
  }

  get position() {
    return this.entity.position
  }

  set position(pos) {
    this.entity.position.copy(pos)
  }

  get rotation() {
    return this.entity.rotation
  }

  resetCollider(height: number) {
    this.collider = new PlayerCollider(height, this.position)
  }

  setPos(pos: Vector3 | string, yaw = 0): void {
    if (this.entity == null || pos == null) {
      return
    }
    if (typeof pos === 'string') {
      const yawMatch = /\s(\d+)$/.exec(pos)
      yaw = yawMatch ? parseInt(yawMatch[1], 10) : 0
      pos = Utils.stringToPos(pos)
    }
    this.entity.position.copy(pos)
    this.setYaw(yaw)
  }

  setYaw(yaw: number) {
    this.entity.rotation.y = Utils.radNormalized(yaw * DEG + Math.PI)
  }

  createBoundingBox(boxHeight: number) {
    const boxPos = new Vector3(0, boxHeight / 2, 0).add(this.position)
    const boundingBox = new Group()
    boundingBox.name = 'boundingBox'
    const mainBoxGeometry = new BoxGeometry(
      Player.BOX_SIDE,
      boxHeight,
      Player.BOX_SIDE
    )
    const topBoxGeometry = new BoxGeometry(
      Player.BOX_SIDE,
      boxHeight - Player.CLIMB_HEIGHT,
      Player.BOX_SIDE
    )
    const bottomBoxGeometry = new BoxGeometry(
      Player.BOX_SIDE,
      Player.CLIMB_HEIGHT,
      Player.BOX_SIDE
    )
    const materials = Array(6).fill(this.boxMaterial)
    const mainBox = new Mesh(mainBoxGeometry, materials)
    const topBox = new Mesh(topBoxGeometry, materials)
    const bottomBox = new Mesh(bottomBoxGeometry, materials)

    topBox.position.set(
      0,
      (boxHeight - (boxHeight - Player.CLIMB_HEIGHT)) / 2,
      0
    )
    bottomBox.position.set(0, (Player.CLIMB_HEIGHT - boxHeight) / 2, 0)
    boundingBox.add(mainBox, topBox, bottomBox)
    boundingBox.position.set(boxPos.x, boxPos.y, boxPos.z)
    boundingBox.userData.mainBox = mainBox
    boundingBox.userData.topBox = topBox
    boundingBox.userData.bottomBox = bottomBox
    this.colliderBox = boundingBox
  }

  async updatePosition(
    deltaSinceLastFrame: number,
    chunksToCheck: LOD[],
    terrain: Group
  ) {
    this.velocity.setY(
      this.isOnFloor && !this.isFlying
        ? 0
        : deltaSinceLastFrame * 0.01 + this.velocity.y
    )

    this.entity.updateMatrixWorld()

    const boxHeight: number = this.collider?.boxHeight

    const deltaPosition = this.velocity
      .clone()
      .multiplyScalar(deltaSinceLastFrame)
    const oldPosition = this.position.clone()
    const newPosition = oldPosition.clone().add(deltaPosition)

    const animation: Promise<AvatarAnimationPlayer> =
      this.avatar.userData.animationPlayer
    const velocity = this.inputSysSvc.controls['moveBck']
      ? -this.velocity.length()
      : this.velocity.length()

    this.state = 'idle'

    if (this.inWater()) {
      this.state = Math.abs(velocity) > 0.5 ? 'swim' : 'float'
    } else if (this.isFlying) {
      this.state = Math.abs(velocity) > 0.5 ? 'fly' : 'hover'
    } else if (this.velocity.y < -10 && !this.isOnFloor) {
      this.state = 'fall'
    } else if (Math.abs(velocity) > 5.5) {
      this.state = 'run'
    } else if (Math.abs(velocity) > 0.1) {
      this.state = 'walk'
    }

    // When applicable: reset gesture on completion
    if (
      (await animation)?.animate(
        deltaSinceLastFrame,
        this.state,
        this.gesture,
        velocity
      )
    ) {
      this.gesture = null
    }

    if (!this.inputSysSvc.controls['clip'] && this.collider) {
      let deltaLength = deltaPosition.length()

      for (let i = 0; deltaLength > 0 && i < Player.MAX_NB_STEPS; i++) {
        // Do not proceed in steps longer than the dimensions on the colliding box
        // Interpolate the movement by moving step by step, stop if we collide with something, continue otherwise
        const deltaScalar = Math.min(Player.MAX_STEP_LENGTH, deltaLength)
        const nextDelta = deltaPosition
          .clone()
          .normalize()
          .multiplyScalar(deltaScalar)
        deltaLength -= Player.MAX_STEP_LENGTH
        if (
          !this.stepPosition(nextDelta, deltaPosition, chunksToCheck, terrain)
        ) {
          break
        }
      }
    } else {
      this.position.copy(newPosition)
    }

    this.collider?.copyPos(this.position)
    this.colliderBox?.position.set(
      this.position.x,
      this.position.y + boxHeight / 2,
      this.position.z
    )

    if (this.position.y < -350) {
      this.velocity.set(0, 0, 0)
      this.position.setY(0)
    }
  }

  private stepPosition(
    delta: Vector3,
    originalDelta: Vector3,
    chunksToCheck: LOD[],
    terrain: Group
  ): boolean {
    const oldPosition = this.position.clone()
    const newPosition = oldPosition.clone().add(delta)

    this.collider.copyPos(newPosition)
    this.boxMaterial?.color.setHex(0x00ff00)

    let climbHeight = null
    let minHeight = null
    let boxCollision = false
    let feetCollision = false
    // Terrain is not being checked for collision yet
    let checkTerrain = 0

    const intersectsTriangle = (tri: Triangle) => {
      // Check if the triangle is intersecting the boundingBox and later adjust the
      // boundingBox position if it is.

      const collision = this.collider.topBoxIntersectsTriangle(tri)
      const rayIntersectionPoint = this.collider.raysIntersectTriangle(tri)

      feetCollision = this.collider.bottomBoxIntersectsTriangle(tri)

      if (collision) {
        boxCollision = true
        this.boxMaterial?.color.setHex(0xff0000)
      }

      if (
        rayIntersectionPoint != null &&
        // Add terrain offset if needed
        rayIntersectionPoint.y + checkTerrain * terrain.position.y >
          newPosition.y
      ) {
        this.boxMaterial?.color.setHex(0xffff00)

        if (climbHeight == null || climbHeight < rayIntersectionPoint.y) {
          climbHeight = rayIntersectionPoint.y
        }

        if (minHeight == null || minHeight < rayIntersectionPoint.y) {
          minHeight = rayIntersectionPoint.y
        }
      }
    }

    // We expect maximum 9 LODs to be available to test collision: the one the player
    // stands in and the 8 neighbouring ones (sides and corners)
    for (const lod of chunksToCheck) {
      const lodOffset = lod.position
      this.collider.translate(lodOffset.negate())
      this.collider.checkBoundsTree(lod.userData.boundsTree, intersectsTriangle)
      this.collider.translate(lodOffset.negate())
    }

    // Since the pages are centered, we need to add an offset
    const centerOffset = (TERRAIN_PAGE_SIZE * 10) / 2
    const pageX: number = Math.floor(
      (newPosition.x + centerOffset) / (TERRAIN_PAGE_SIZE * 10)
    )
    const pageZ: number = Math.floor(
      (newPosition.z + centerOffset) / (TERRAIN_PAGE_SIZE * 10)
    )
    const terrainPage = terrain?.getObjectByName(`${pageX}_${pageZ}`) as Mesh

    if (climbHeight == null && terrainPage != null) {
      // Terrain is now being checked for collision
      checkTerrain = 1
      const pageOffset = terrainPage.position.clone().setY(terrain.position.y)
      this.collider.translate(pageOffset.negate())
      this.collider.checkBoundsTree(
        terrainPage.geometry.boundsTree,
        intersectsTriangle
      )
      this.collider.translate(pageOffset.negate())
    }

    if (boxCollision) {
      this.velocity.set(0, 0, 0)
      this.collider.copyPos(oldPosition)
      this.position.copy(oldPosition)
      return false
    }

    if (this.velocity.y <= 0 && climbHeight !== null) {
      // Player is on floor
      this.velocity.setY(0)
      // Add terrain offset if needed
      climbHeight += checkTerrain * terrain.position.y
      newPosition.setY(climbHeight - Player.GROUND_ADJUST)
      this.isOnFloor = true
      this.isFlying = false
    } else {
      this.isOnFloor = false
    }

    if (
      this.velocity.y > 0 &&
      minHeight !== null &&
      climbHeight !== minHeight
    ) {
      // Player hits the ceiling
      this.velocity.setY(0)
      newPosition.setY(minHeight - Player.GROUND_ADJUST)
    }

    if (
      climbHeight === null &&
      feetCollision &&
      newPosition.y + Player.GROUND_ADJUST < oldPosition.y
    ) {
      // Prevent the player from falling in a small gap
      this.velocity.setY(0)
      newPosition.setY(oldPosition.y)
    }

    if (feetCollision) {
      this.isFlying = false
      if (originalDelta.y < 0) {
        originalDelta.setY(0)
      }
    }

    this.collider.copyPos(newPosition)
    this.position.copy(newPosition)

    return true
  }
}
