import type {LOD, Mesh, Vector3Like} from 'three'
import type {MeshBVH} from 'three-mesh-bvh'
import {inject, signal} from '@angular/core'
import {Group, Object3D, Vector3} from 'three'
import type {AvatarAnimationPlayer} from '../animation'
import {environment} from '../../environments/environment'
import {DEG, TERRAIN_PAGE_SIZE} from '../utils/constants'
import {radNormalized, stringToPos} from '../utils/utils'
import {InputSystemService} from './inputsystem.service'
import {PlayerCollider} from './player-collider'

export class Player {
  private static readonly GROUND_ADJUST =
    environment.world.collider.groundAdjust
  private static readonly MAX_STEP_LENGTH =
    environment.world.collider.maxStepLength
  private static readonly MAX_NB_STEPS = environment.world.collider.maxNbSteps
  private static readonly BASE_GRAVITY = environment.world.physics.baseGravity
  private static readonly JUMP_VELOCITY = environment.world.physics.jumpVelocity
  private static readonly MAX_FALL_SPEED =
    environment.world.physics.maxFallSpeed

  private readonly inputSysSvc = inject(InputSystemService)

  avatar: Group
  state = 'idle'
  gesture: string | null = null
  gravity = 1
  inWater = signal(false)
  collider: PlayerCollider
  entity: Object3D

  private isFlying = false
  private isOnFloor = true
  private wasJumping = false
  private velocity = new Vector3()

  private tmpNewPosition = new Vector3()
  private tmpTerrainPageOffset = new Vector3()
  private tmpDeltaPosition = new Vector3()
  private tmpOldPosition = new Vector3()
  private tmpNextDelta = new Vector3()

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

  setPos(pos: Vector3Like | string, yaw = 0): void {
    if (this.entity == null || pos == null) {
      return
    }
    if (typeof pos === 'string') {
      const yawMatch = /\s([0-9]+)$/.exec(pos)
      yaw = yawMatch ? parseInt(yawMatch[1], 10) : 0
      pos = stringToPos(pos)
    }
    this.position.copy(pos)
    this.setYaw(yaw)
    this.velocity.set(0, 0, 0)
    this.isOnFloor = true
  }

  setYaw(yaw: number) {
    this.entity.rotation.y = radNormalized(yaw * DEG + Math.PI)
  }

  updatePosition(
    deltaSinceLastFrame: number,
    cameraDirection: Vector3,
    reverse: number,
    chunksToCheck: LOD[],
    terrain: Group
  ) {
    this.applyControls(deltaSinceLastFrame, cameraDirection, reverse)
    this.entity.updateMatrixWorld()

    const boxHeight: number = this.collider?.boxHeight

    this.tmpDeltaPosition
      .copy(this.velocity)
      .multiplyScalar(deltaSinceLastFrame)
    this.tmpNewPosition.copy(this.position).add(this.tmpDeltaPosition)

    const animation: AvatarAnimationPlayer | undefined =
      this.avatar.userData.animationPlayer
    const totalSpeed = this.velocity.length()
    const horizontalSpeed = Math.hypot(this.velocity.x, this.velocity.z)
    const speed = this.inWater() || this.isFlying ? totalSpeed : horizontalSpeed
    const velocity = this.inputSysSvc.controls['moveBck'] ? -speed : speed

    this.state = 'idle'

    if (this.inWater()) {
      this.state = totalSpeed > 0.5 ? 'swim' : 'float'
    } else if (this.isFlying) {
      this.state = totalSpeed > 0.5 ? 'fly' : 'hover'
    } else if (this.velocity.y < -10 && !this.isOnFloor) {
      this.state = 'fall'
    } else if (horizontalSpeed > 5.5) {
      this.state = 'run'
    } else if (horizontalSpeed > 0.1) {
      this.state = 'walk'
    }

    // When applicable: reset gesture on completion
    if (
      animation?.animate(
        deltaSinceLastFrame,
        this.state,
        this.gesture,
        velocity
      )
    ) {
      this.gesture = null
    }

    if (!this.inputSysSvc.controls['clip'] && this.collider) {
      let deltaLength = this.tmpDeltaPosition.length()

      for (let i = 0; deltaLength > 0 && i < Player.MAX_NB_STEPS; i++) {
        // Do not proceed in steps longer than the dimensions on the colliding box
        // Interpolate the movement by moving step by step, stop if we collide with something, continue otherwise
        const deltaScalar = Math.min(Player.MAX_STEP_LENGTH, deltaLength)
        this.tmpNextDelta
          .copy(this.tmpDeltaPosition)
          .normalize()
          .multiplyScalar(deltaScalar)
        deltaLength -= Player.MAX_STEP_LENGTH
        if (
          !this.stepPosition(
            this.tmpNextDelta,
            this.tmpDeltaPosition,
            chunksToCheck,
            terrain
          )
        ) {
          break
        }
      }
    } else {
      this.position.copy(this.tmpNewPosition)
    }

    this.collider?.copyPos(this.position)
    this.collider?.colliderBox?.position.set(
      this.position.x,
      this.position.y + boxHeight / 2,
      this.position.z
    )

    if (this.position.y < -350) {
      this.velocity.set(0, 0, 0)
      this.position.setY(0)
    }
  }

  private applyControls(
    deltaSinceLastFrame: number,
    cameraDirection: Vector3,
    reverse: number
  ) {
    const controls = this.inputSysSvc.controls
    let movSteps = 12 * deltaSinceLastFrame
    let rotSteps = 1.5 * deltaSinceLastFrame
    if (controls['run']) {
      movSteps = this.isFlying
        ? 72 * deltaSinceLastFrame
        : 24 * deltaSinceLastFrame
      rotSteps *= 3
    }
    const dirX = reverse * movSteps * cameraDirection.x
    const dirZ = reverse * movSteps * cameraDirection.z
    const sideX = reverse * movSteps * cameraDirection.z
    const sideZ = reverse * movSteps * -cameraDirection.x

    if (controls['moveFwd']) {
      this.velocity.x += dirX
      this.velocity.z += dirZ
    }
    if (controls['moveBck']) {
      this.velocity.x -= dirX
      this.velocity.z -= dirZ
    }
    if (controls['turnLft']) {
      if (controls['clip']) {
        this.velocity.x += sideX
        this.velocity.z += sideZ
      } else {
        this.rotation.y = radNormalized(this.rotation.y + reverse * rotSteps)
      }
    }
    if (controls['turnRgt']) {
      if (controls['clip']) {
        this.velocity.x -= sideX
        this.velocity.z -= sideZ
      } else {
        this.rotation.y = radNormalized(this.rotation.y - reverse * rotSteps)
      }
    }
    if (controls['moveLft']) {
      this.velocity.x += sideX
      this.velocity.z += sideZ
    }
    if (controls['moveRgt']) {
      this.velocity.x -= sideX
      this.velocity.z -= sideZ
    }
    if (controls['lookUp'] && this.rotation.x < Math.PI / 2) {
      this.rotation.x += rotSteps
    }
    if (controls['lookDwn'] && this.rotation.x > -Math.PI / 2) {
      this.rotation.x -= rotSteps
    }
    if (controls['moveUp']) {
      this.isFlying = true
      this.velocity.y += movSteps
    }
    if (controls['moveDwn']) {
      this.isFlying = true
      this.velocity.y -= movSteps
    }

    const isJumping = controls['jmp']
    if (isJumping && !this.wasJumping && this.isOnFloor) {
      this.velocity.y = Player.JUMP_VELOCITY
      this.isOnFloor = false
    }
    this.wasJumping = isJumping

    const damping = Math.exp(-3 * deltaSinceLastFrame) - 1
    this.velocity.x += this.velocity.x * damping
    this.velocity.z += this.velocity.z * damping
    if (this.isFlying || controls['clip']) {
      this.velocity.y += this.velocity.y * damping
    } else if (!this.isOnFloor || this.gravity < 0) {
      const gravityAccel = Player.BASE_GRAVITY * this.gravity
      this.velocity.y = Math.max(
        -Player.MAX_FALL_SPEED,
        Math.min(
          Player.MAX_FALL_SPEED,
          this.velocity.y - gravityAccel * deltaSinceLastFrame
        )
      )
    }
  }

  private stepPosition(
    delta: Vector3,
    originalDelta: Vector3,
    chunksToCheck: LOD[],
    terrain: Group
  ): boolean {
    this.tmpOldPosition.copy(this.position)
    this.tmpNewPosition.copy(this.tmpOldPosition).add(delta)
    this.collider.resetStep(this.tmpNewPosition)

    // We expect maximum 9 LODs to be available to test collision: the one the player
    // stands in and the 8 neighbouring ones (sides and corners)
    for (const lod of chunksToCheck) {
      this.collider.testBoundsTree(lod.userData.boundsTree, lod.position)
      if (this.collider.boxCollision) {
        break
      }
    }

    if (!this.collider.boxCollision && terrain != null) {
      // Since the pages are centered, we need to add an offset
      const pageSize = TERRAIN_PAGE_SIZE * 10
      const centerOffset = pageSize / 2
      const pageX = Math.floor(
        (this.tmpNewPosition.x + centerOffset) / pageSize
      )
      const pageZ = Math.floor(
        (this.tmpNewPosition.z + centerOffset) / pageSize
      )
      const terrainPage = terrain.getObjectByName(`${pageX}_${pageZ}`) as Mesh
      if (terrainPage != null) {
        this.tmpTerrainPageOffset
          .copy(terrainPage.position)
          .setY(terrain.position.y)
        this.collider.testBoundsTree(
          terrainPage.geometry.boundsTree as MeshBVH,
          this.tmpTerrainPageOffset
        )
      }
    }

    if (this.collider.boxCollision) {
      this.velocity.set(0, 0, 0)
      this.collider.copyPos(this.tmpOldPosition)
      this.position.copy(this.tmpOldPosition)
      return false
    }

    const {climbHeight, feetCollision} = this.collider

    if (this.velocity.y <= 0 && climbHeight != null) {
      // Player is on floor
      this.velocity.setY(0)
      this.tmpNewPosition.setY(climbHeight - Player.GROUND_ADJUST)
      this.isOnFloor = true
      this.isFlying = false
    } else {
      this.isOnFloor = false
    }

    if (
      climbHeight == null &&
      feetCollision &&
      this.tmpNewPosition.y + Player.GROUND_ADJUST < this.tmpOldPosition.y
    ) {
      // Prevent the player from falling in a small gap
      this.velocity.setY(0)
      this.tmpNewPosition.setY(this.tmpOldPosition.y)
    }

    if (feetCollision && this.velocity.y <= 0) {
      this.isFlying = false
      if (originalDelta.y < 0) {
        originalDelta.setY(0)
      }
    }

    this.collider.copyPos(this.tmpNewPosition)
    this.position.copy(this.tmpNewPosition)

    return true
  }
}
