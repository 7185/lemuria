import {computed, inject, Injectable} from '@angular/core'
import parseSequence, {FileType, getJointTag} from 'aw-sequence-parser'
import {EngineService} from '../engine/engine.service'
import {PropService} from '../world/prop.service'
import {AvatarAnimationManager} from './avatar-animation.manager'
import {Quaternion, Vector3} from 'three'
import * as fflate from 'fflate'

export interface ThreeSequence {
  original: ParsedSequence | null
  frames: {joints: Record<string, Quaternion>; location: Vector3}[]
  frameRate: number
  rootJointTag: number
  keyFrameIDs: number[]
}

export interface ParsedSequence {
  fileType: string
  totalNFrames: number
  nJoints: number
  modelName: string
  rootJointName: string
  frames: object
}

export interface StepState {
  total: number
  frameRate: number
  current: number
}

export const interpolateThreeFrames = (
  threeFrames: ThreeSequence['frames'],
  firstKeyId: number,
  secondKeyId: number
) => {
  const offset =
    firstKeyId < secondKeyId
      ? secondKeyId - firstKeyId
      : threeFrames.length - firstKeyId + secondKeyId

  if (offset <= 1) {
    // Those two keyframes stand next to eachother or are identical, nothing to interpolate
    return
  }

  const firstKey = threeFrames[firstKeyId]
  const secondKey = threeFrames[secondKeyId]
  const firstJoints = firstKey.joints
  const secondJoints = secondKey.joints

  // Interpolate between two keyframes
  for (let j = 1; j < offset; j++) {
    const ratio = j / offset
    const frame = threeFrames[(firstKeyId + j) % threeFrames.length]

    // Computing intermediate location
    frame.location.copy(firstKey.location).lerp(secondKey.location, ratio)

    // Now taking care of quaternions on joints
    const {joints} = frame

    for (const [jointTag, q] of Object.entries(firstJoints)) {
      if (secondJoints[jointTag] === undefined) {
        // This is a bit worrysome if the second key were to be missing a joint,
        // but we don't stop the whole process just for this and move on
        continue
      }

      joints[jointTag] = q.clone().slerp(secondJoints[jointTag], ratio)
    }
  }
}

@Injectable({providedIn: 'root'})
export class AvatarAnimationService {
  private sequences = new Map<string, Promise<ThreeSequence> | null>()
  private avatarAnimationManagers = new Map<
    string,
    Promise<AvatarAnimationManager>
  >()
  private sequenceParserOpts: {fileType: FileType; fflate: unknown} = {
    fileType: FileType.AUTO,
    fflate
  }
  private readonly engineSvc = inject(EngineService)
  private readonly propSvc = inject(PropService)

  private frameRate = computed(() => {
    const newFrameRate = this.engineSvc.maxFps()
    this.handleFrameRateChange(newFrameRate)
    return newFrameRate
  })

  async loadSequence(name: string, uri: string) {
    if (this.sequences.has(name)) {
      return this.sequences.get(name)!
    }
    try {
      const seq: ParsedSequence = await parseSequence(
        uri,
        this.sequenceParserOpts
      )
      const parsedSeq = this.interpolate(this.toThree(seq))
      this.sequences.set(name, Promise.resolve(parsedSeq))
      return parsedSeq
    } catch (_) {
      // This sequence name is considered invalid, so keeping a null entry in the registry map
      // ensures the service won't try to load it each time it is referenced
      this.sequences.set(name, null)
      return null
    }
  }

  getAvatarAnimationManager(
    name: string,
    implicit: Map<string, string>,
    explicit: Map<string, string>,
    extension = '.zip'
  ) {
    if (this.avatarAnimationManagers.has(name)) {
      return this.avatarAnimationManagers.get(name)!
    }
    const mgrPromise = this.loadAvatarAnimationManager(
      name,
      implicit,
      explicit,
      extension
    )
    this.avatarAnimationManagers.set(name, mgrPromise)
    return mgrPromise
  }

  async handleFrameRateChange(frameRate: number) {
    if (!this.sequences) {
      return
    }

    /* Update existing sequences */
    for (const entry of this.sequences) {
      const seq = await entry[1]
      if (seq.frameRate > frameRate) {
        return
      }

      const newSeq = this.interpolate(this.toThree(seq.original))
      seq.frames = newSeq.frames
      seq.frameRate = newSeq.frameRate
      seq.keyFrameIDs = newSeq.keyFrameIDs
    }
  }

  cleanCache() {
    this.sequences.clear()
    this.avatarAnimationManagers.clear()
  }

  private async loadAvatarAnimationManager(
    name: string,
    implicit: Map<string, string>,
    explicit: Map<string, string>,
    extension: string
  ) {
    const implicitSequences = new Map<string, ThreeSequence | null>()
    const explicitSequences = new Map<string, ThreeSequence | null>()

    for (const [key, filename] of implicit) {
      try {
        const seq = await this.loadSequence(
          filename,
          `${this.propSvc.path()}/seqs/${filename}${extension}`
        )
        implicitSequences.set(key, seq)
      } catch (_) {
        implicitSequences.set(key, null)
      }
    }

    for (const [key, filename] of explicit) {
      try {
        const seq = await this.loadSequence(
          filename,
          `${this.propSvc.path()}/seqs/${filename}${extension}`
        )
        explicitSequences.set(key, seq)
      } catch (_) {
        explicitSequences.set(key, null)
      }
    }

    return new AvatarAnimationManager(
      name,
      implicitSequences,
      explicitSequences
    )
  }

  private toThree(sequence: ParsedSequence): ThreeSequence {
    const keyFrameIDs: number[] = []
    const rootJointTag: number = getJointTag(sequence.rootJointName) || 1
    const nbFrames: number = sequence.totalNFrames

    const threeFrames: ThreeSequence['frames'] = Array.from(
      {length: nbFrames},
      () => ({joints: {}, location: new Vector3()})
    )

    for (const [frameId, frame] of Object.entries(sequence.frames)) {
      if (frame === undefined) {
        continue
      }

      const fId: number = parseInt(frameId, 10) - 1

      if (fId >= nbFrames || fId < 0) {
        continue
      }

      const location: [number, number, number] = frame.location || [0, 0, 0]
      keyFrameIDs.push(fId)
      threeFrames[fId].location.set(...location).multiplyScalar(0.1)

      for (const [jointName, q] of Object.entries(frame.joints)) {
        threeFrames[fId].joints[getJointTag(jointName)] = new Quaternion(
          -q[1],
          -q[2],
          q[3],
          q[0]
        )
      }
    }

    return {
      original: sequence,
      frameRate: 30,
      frames: threeFrames,
      rootJointTag,
      keyFrameIDs
    }
  }

  private interpolate(sequence: ThreeSequence): ThreeSequence {
    // Upscale if needed
    if (sequence.frameRate < this.frameRate()) {
      const ratio = this.frameRate() / sequence.frameRate
      const threeFrames = Array.from(
        {length: Math.floor(sequence.frames.length * ratio)},
        () => ({joints: {}, location: new Vector3()})
      )

      const keyFrameIDs = sequence.keyFrameIDs.map((id) =>
        Math.floor(id * ratio)
      )
      keyFrameIDs.forEach((id, index) => {
        threeFrames[id] = sequence.frames[sequence.keyFrameIDs[index]]
      })

      sequence.frameRate = this.frameRate()
      sequence.frames = threeFrames
      sequence.keyFrameIDs = keyFrameIDs
    }

    // Fill the gap between each key frame (if any)
    for (let i = 0; i < sequence.keyFrameIDs.length - 1; i++) {
      interpolateThreeFrames(
        sequence.frames,
        sequence.keyFrameIDs[i],
        sequence.keyFrameIDs[i + 1]
      )
    }

    return sequence
  }
}
