import {Injectable} from '@angular/core'
import type {Group} from 'three'
import {RPM, X_AXIS, Y_AXIS, Z_AXIS} from '../utils/constants'

@Injectable({providedIn: 'root'})
export class PropAnimationService {
  moveProp(prop: Group, delta: number) {
    const moveData = prop.userData.animation.move
    if (moveData == null) {
      return
    }
    if (moveData.waiting > 0) {
      // We're still waiting
      moveData.waiting -= delta
      return
    }
    // Update position
    // If reset is set, we have to do the move twice so we force the direction here
    // in order to keep the state (if direction is -1, we're on the second move)
    const moveFactor =
      (moveData.reset ? 1 : moveData.direction) * (delta / moveData.time)
    prop.position.x += moveData.distance.x * moveFactor
    prop.position.y += moveData.distance.y * moveFactor
    prop.position.z += moveData.distance.z * moveFactor
    moveData.completion += delta / moveData.time

    // Check if the prop has reached its destination (completion = 1)
    if (moveData.completion >= 1) {
      moveData.completion = 0
      if (moveData.reset) {
        // Reset the position to the original position
        prop.position
          .copy(prop.userData.posOrig)
          .sub(prop.parent.parent.position)
      }

      if (moveData.direction < 0) {
        if (!moveData.loop) {
          // No loop and way back is done, so all is done
          prop.userData.animation.move = undefined
          return
        }
        // Move is complete for this loop so we can force the initial position back to avoid drifting issues
        prop.position
          .copy(prop.userData.posOrig)
          .sub(prop.parent.parent.position)
      }
      // Switch direction
      moveData.direction *= -1
      // Add a wait time before starting the way back
      moveData.waiting = moveData.wait
    }
  }

  rotateProp(prop: Group, delta: number) {
    const rotateData = prop.userData.animation.rotate
    if (rotateData == null) {
      return
    }
    if (rotateData.waiting > 0) {
      // We're still waiting
      rotateData.waiting -= delta
      return
    }
    // Update rotation
    prop.rotateOnAxis(
      Y_AXIS,
      rotateData.speed.y * RPM * delta * rotateData.direction
    )
    prop.rotateOnAxis(
      Z_AXIS,
      rotateData.speed.z * RPM * delta * rotateData.direction
    )
    prop.rotateOnAxis(
      X_AXIS,
      rotateData.speed.x * RPM * delta * rotateData.direction
    )
    // Update the rotation completion based on the provided time
    rotateData.completion += delta / (rotateData.time || 1)
    // Check if rotation has completed (completion >= 1)
    if (rotateData.completion >= 1) {
      rotateData.completion = 0
      if (rotateData.reset || rotateData.direction === -1) {
        // Reset the rotation to the original rotation
        prop.rotation.copy(prop.userData.rotOrig)
      }
      if (rotateData.time) {
        // Add a wait time before starting the next rotation
        rotateData.waiting = rotateData.wait
        if (!rotateData.loop && rotateData.direction === -1) {
          // No loop and the way back is done, so the rotation is over
          prop.userData.animation.rotate = undefined
          return
        }
        // Loop and/or way back is starting
        if (!rotateData.reset) {
          // Reverse the rotation direction for the next rotation
          rotateData.direction *= -1
        }
      }
    }
  }
}
