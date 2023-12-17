import {Injectable} from '@angular/core'
import type {Group} from 'three'
import {Vector3} from 'three'
export const DEG = Math.PI / 180
export const RPM = Math.PI / 30
export const X_AXIS = new Vector3(1, 0, 0)
export const Y_AXIS = new Vector3(0, 1, 0)
export const Z_AXIS = new Vector3(0, 0, 1)

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
    } else if (moveData.completion < 1) {
      // If the move is in progress, update the item's position
      const moveFactor = moveData.direction * (delta / moveData.time)
      item.position.x += moveData.distance.x * moveFactor
      item.position.y += moveData.distance.y * moveFactor
      item.position.z += moveData.distance.z * moveFactor
      moveData.completion += delta / moveData.time

      // Check if the item has reached its destination (completion = 1)
      if (moveData.completion >= 1) {
        if (moveData.loop) {
          // If looping is enabled, reset the completion and change the direction for the way back
          moveData.direction *= -1
          moveData.completion = 0
          // Add a wait time before starting the way back
          moveData.waiting = moveData.wait
        } else {
          // If looping is not enabled, set the completion to 1 to indicate the move is finished
          moveData.completion = 1
        }
        if (moveData.reset && moveData.direction === -1) {
          // Reset the item's position to the original position
          item.position.copy(
            new Vector3().add(moveData.orig).sub(item.parent.parent.position)
          )
          moveData.direction = 1
        }
      }
    } else if (moveData.direction === -1) {
      // If the way back is done and direction is -1 (indicating the way back)
      if (moveData.loop) {
        // If looping is enabled, reset the direction and completion for the next forward movement
        moveData.direction *= -1
        moveData.completion = 0
        // Add a wait time before starting the next forward movement
        moveData.waiting = moveData.wait
        // The item should be back to it's initial position
        item.position.copy(
          new Vector3().add(moveData.orig).sub(item.parent.parent.position)
        )
      }
    } else {
      // Way back is starting
      // Reset the direction and completion for the way back
      moveData.direction *= -1
      moveData.completion = 0
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
    } else {
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
      rotateData.completion += delta / rotateData.time
      // Check if rotation has completed (completion >= 1)
      if (rotateData.completion >= 1) {
        rotateData.completion = 0
        if (rotateData.reset) {
          // Reset the rotation to the original rotation
          item.rotation.copy(rotateData.orig)
        } else {
          if (!rotateData.loop && rotateData.direction < 0) {
            // No loop and way back is finished so all is done
            item.rotation.copy(rotateData.orig)
            item.userData.animation.rotate = undefined
            return
          }
          // Add a wait time before starting the next rotation
          rotateData.waiting = rotateData.wait
          // Reverse the rotation direction for the next rotation
          rotateData.direction *= -1
        }
      }
    }
  }
}
