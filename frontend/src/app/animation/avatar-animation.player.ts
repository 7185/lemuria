import {Group, Quaternion, Vector3} from 'three'
import type {AvatarAnimationManager} from './avatar-animation.manager'
import type {ThreeSequence, StepState} from './animation.service'
import {interpolateThreeFrames} from './animation.service'

interface AnimationEntry {
  name: string
  velocityMultiplier: number
}
interface Frame {
  joints: Record<string, Quaternion>
  location: Vector3
}

const transitionDuration = 0.1

export class AvatarAnimationPlayer {
  private avatarView = {}
  private currentState: AnimationEntry = {name: 'idle', velocityMultiplier: 1.0}
  private currentStepState: StepState = null
  private lastPlayedFrame = this.makeNullFrame()
  private currentTransition: ThreeSequence = null
  private currentGesture: string = null

  constructor(
    private avatarAnimationManager: AvatarAnimationManager,
    avatarGroup: Group
  ) {
    this.populateAvatarViewRecursive(avatarGroup)
  }

  static computeTransition = (
    firstFrame: Frame,
    lastFrame: Frame,
    duration: number,
    frameRate: number
  ) => {
    const transition: ThreeSequence = {
      original: null,
      frames: [],
      frameRate,
      rootJointTag: 1,
      keyFrameIDs: []
    }
    const nbFrames = Math.floor(duration * frameRate)

    transition.frames.push(firstFrame)
    transition.frames.push(
      ...Array.from({length: nbFrames - 1}, () => ({
        joints: {},
        location: new Vector3()
      }))
    )
    transition.frames.push(lastFrame)

    interpolateThreeFrames(transition.frames, 0, transition.frames.length - 1)

    return transition
  }

  public animate(
    deltaSecond: number,
    state: string = 'idle',
    gesture: string = null,
    velocity: number = 0
  ): boolean {
    // Choose which state to move in based on the velocity

    let newFallbackState = null
    let newState = null
    const newGesture = gesture

    switch (state) {
      case 'walk':
        newState = {name: 'walk', velocityMultiplier: 1.7}
        break
      case 'run':
        newState = {name: 'run', velocityMultiplier: 0.5}
        newFallbackState = {name: 'walk', velocityMultiplier: 1.7}
        break
      case 'fly':
        newState = {name: 'fly', velocityMultiplier: null}
        newFallbackState = {name: 'walk', velocityMultiplier: 0.5}
        break
      default:
        newState = {name: 'idle', velocityMultiplier: null}
        break
    }

    const animationList = [newState]

    if (newFallbackState) {
      animationList.push(newFallbackState)
    }

    // Check for gesture change, compute transition if need be
    if (newGesture !== this.currentGesture && newGesture !== null) {
      const newFrame = this.makeNullFrame()
      const newSequence =
        this.avatarAnimationManager.explicitSequences.get(newGesture)

      this.currentStepState = null

      if (newSequence) {
        // Gesture found, interpolate transition
        newFrame.joints = newSequence.frames[0].joints
        newFrame.location.copy(newSequence.frames[0].location)
        this.currentGesture = newGesture

        this.currentTransition = AvatarAnimationPlayer.computeTransition(
          this.lastPlayedFrame,
          newFrame,
          transitionDuration,
          this.currentStepState?.frameRate || 60
        )
      } else {
        // Gesture not found, so we return true to notify the caller of completion and move on
        this.currentTransition = null
        this.currentGesture = null
        return true
      }
    } else if (newState.name !== this.currentState.name) {
      // Check for state change, compute transition if need be (but only if we're not in the middle of a gesture)
      const newFrame = this.makeNullFrame()
      const newSequence = this.findBestAnimation(animationList)[0]

      if (newSequence) {
        newFrame.joints = newSequence.frames[0].joints
        newFrame.location.set(0, 0, 0)
      }

      this.currentTransition = AvatarAnimationPlayer.computeTransition(
        this.lastPlayedFrame,
        newFrame,
        transitionDuration,
        this.currentStepState?.frameRate || 60
      )
      this.currentStepState = null
    }

    if (!newGesture) {
      this.currentGesture = null
    }

    this.currentState = newState

    // If we're in a transition: keep playing it instead of the animation from current state or gesture
    if (this.currentTransition) {
      // 'step' returns 'true' on animation completion (when not looping)
      if (this.step(this.currentTransition, deltaSecond, true, false)) {
        this.currentStepState = null
        this.currentTransition = null
      }
      return false
    }

    // Play gesture (if any)
    if (this.currentGesture) {
      // 'stepExplicit' returns 'true' on gesture completion
      if (this.stepExplicit(this.currentGesture, deltaSecond)) {
        this.currentStepState = null
        this.currentGesture = null
        return true
      }

      // When returning false: we notify the caller that we're not done yet
      return false
    }

    this.stepImplicit(animationList, deltaSecond, velocity)

    return false
  }

  public reset() {
    // Reset the state of the avatar
    for (const entry of Object.entries(this.avatarView)) {
      ;(entry[1] as Group).setRotationFromQuaternion(new Quaternion())
    }

    this.avatarView['1']?.position.set(0, 0, 0)
  }

  public makeNullFrame(): Frame {
    const frame: Frame = {joints: {}, location: new Vector3()}

    for (const entry of Object.entries(this.avatarView)) {
      frame.joints[entry[0]] = new Quaternion()
    }

    return frame
  }

  private findBestAnimation(animationList: AnimationEntry[]): any[] {
    let threeSequence: ThreeSequence = null

    // Iterate of each proposed animation
    for (const entry of animationList) {
      threeSequence = this.avatarAnimationManager.implicitSequences.get(
        entry.name
      )

      if (threeSequence) {
        // If some sequence was found: return it right away
        return [threeSequence, entry.velocityMultiplier]
      }
    }

    return [null, null]
  }

  private stepImplicit(
    animationList: AnimationEntry[],
    deltaSecond: number,
    velocity: number = 1
  ) {
    // Iterate over each proposed animation
    const [threeSequence, velocityMultiplier] =
      this.findBestAnimation(animationList)

    if (threeSequence) {
      // We found an existing sequence matching that name, we compute the step to make using velocity
      // for smoother-looking acceleration if need be.
      // Note: location from frames is not meant to be applied in implicit animations (hence the 'false')
      this.step(
        threeSequence,
        velocityMultiplier !== null
          ? deltaSecond * velocity * velocityMultiplier
          : deltaSecond,
        false,
        true
      )
      return
    }

    // No match found given the provided, so we just reset the avatar pose
    this.reset()
  }

  private stepExplicit(
    animationName: string,
    frameOffset: number = 0
  ): boolean {
    return this.step(
      this.avatarAnimationManager.explicitSequences.get(animationName),
      frameOffset,
      true,
      false
    )
  }

  private step(
    threeSequence: ThreeSequence,
    deltaSecond: number,
    updateLocation: boolean,
    loop: boolean
  ): boolean {
    if (!this.currentStepState) {
      this.currentStepState = {
        total: threeSequence.frames.length,
        frameRate: threeSequence.frameRate,
        current: 0
      }
    }

    // Compute the new frame ID, take looping into account
    const current =
      this.currentStepState.current +
      Math.floor(deltaSecond * this.currentStepState.frameRate)
    this.currentStepState.current = loop
      ? current % this.currentStepState.total
      : current

    while (loop && this.currentStepState.current < 0) {
      // this ensures that we can also always loop from a negative offset
      this.currentStepState.current += this.currentStepState.total
    }

    if (this.currentStepState.frameRate !== threeSequence.frameRate) {
      // Scale the current cursor position based on frameRate change
      const ratio = threeSequence.frameRate / this.currentStepState.frameRate
      this.currentStepState.current = Math.floor(
        this.currentStepState.current * ratio
      )
      this.currentStepState.frameRate = threeSequence.frameRate
      this.currentStepState.total = threeSequence.frames.length
    }

    const {rootJointTag} = threeSequence
    const frame = threeSequence.frames[this.currentStepState.current]

    if (frame === undefined) {
      // Frame not found, we're done with the current animation
      return true
    } else {
      this.lastPlayedFrame.joints = frame.joints
      if (!updateLocation) {
        this.lastPlayedFrame.location.set(0, 0, 0)
      }
    }

    for (const [key, q] of Object.entries(frame.joints)) {
      if (this.avatarView[key] === undefined) {
        continue
      }

      this.avatarView[key].setRotationFromQuaternion(q)
    }

    if (updateLocation && this.avatarView[rootJointTag] !== undefined) {
      this.avatarView[rootJointTag].position.copy(frame.location)
    }

    return false
  }

  private populateAvatarViewRecursive(threeNode: Group) {
    if (threeNode.userData?.rwx?.tag) {
      this.avatarView[threeNode.userData.rwx.tag] = threeNode
    }

    threeNode.children.forEach((child) => {
      if (child instanceof Group) {
        this.populateAvatarViewRecursive(child)
      }
    })
  }
}
