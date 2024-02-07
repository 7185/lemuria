import {Injectable} from '@angular/core'
import type {Group} from 'three'
import {Vector3} from 'three'
import {RPM, X_AXIS, Y_AXIS, Z_AXIS} from '../utils'

@Injectable({providedIn: 'root'})
export class PropAnimationService {
  public moveItem(item: Group, delta: number) {
    const moveData = item.userData.animation.move
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
    item.position.x += moveData.distance.x * moveFactor
    item.position.y += moveData.distance.y * moveFactor
    item.position.z += moveData.distance.z * moveFactor
    moveData.completion += delta / moveData.time

    // Check if the item has reached its destination (completion = 1)
    if (moveData.completion >= 1) {
      moveData.completion = 0
      if (moveData.reset) {
        // Reset the position to the original position
        item.position.copy(
          new Vector3()
            .add(item.userData.posOrig)
            .sub(item.parent.parent.position)
        )
      }

      if (moveData.direction < 0) {
        if (!moveData.loop) {
          // No loop and way back is done, so all is done
          item.userData.animation.move = undefined
          return
        }
        // Move is complete for this loop so we can force the initial position back to avoid drifting issues
        item.position.copy(
          new Vector3()
            .add(item.userData.posOrig)
            .sub(item.parent.parent.position)
        )
      }
      // Switch direction
      moveData.direction *= -1
      // Add a wait time before starting the way back
      moveData.waiting = moveData.wait
    }
  }

  public rotateItem(item: Group, delta: number) {
    const rotateData = item.userData.animation.rotate
    if (rotateData == null) {
      return
    }
    if (rotateData.waiting > 0) {
      // We're still waiting
      rotateData.waiting -= delta
      return
    }
    // Update rotation
    item.rotateOnAxis(
      Y_AXIS,
      rotateData.speed.y * RPM * delta * rotateData.direction
    )
    item.rotateOnAxis(
      Z_AXIS,
      rotateData.speed.z * RPM * delta * rotateData.direction
    )
    item.rotateOnAxis(
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
        item.rotation.copy(item.userData.rotOrig)
      }
      if (rotateData.time) {
        // Add a wait time before starting the next rotation
        rotateData.waiting = rotateData.wait
        if (!rotateData.loop && rotateData.direction === -1) {
          // No loop and the way back is done, so the rotation is over
          item.userData.animation.rotate = undefined
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
