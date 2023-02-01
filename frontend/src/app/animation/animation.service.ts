import {Injectable} from '@angular/core'
import parseSequence, {FileType, getJointTag} from 'aw-sequence-parser'
import {EngineService} from '../engine/engine.service'
import {ObjectService} from '../world/object.service'
import {AvatarAnimationManager} from './avatar.animation.manager'
import {Quaternion, Vector3} from 'three'
import * as fflate from 'fflate'

export type AvatarSequences = {
  implicit: Map<string, string>
  explicit: Map<string, string>
}

export type ThreeSequence = {
  original: any
  frames: any[]
  frameRate: number
  rootJointTag: number
  keyFrameIDs: number[]
}
export type StepState = {total: number; frameRate: number; current: number}

export const interpolateThreeFrames = (
  threeFrames: any[],
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
    frame.location.firstKeyId = firstKeyId
    frame.location.secondKeyId = secondKeyId
    frame.location.offset = offset
    frame.location.ratio = ratio

    // Now taking care of quaternions on joints
    const joints = frame.joints

    for (const [jointTag, q] of Object.entries(firstJoints)) {
      if (secondJoints[jointTag] === undefined) {
        // This is a bit worrysome if the second key were to be missing a joint,
        // but we don't stop the whole process just for this and move on
        continue
      }

      joints[jointTag] = (q as Quaternion)
        .clone()
        .slerp(secondJoints[jointTag], ratio)
    }
  }
}

@Injectable({providedIn: 'root'})
export class AnimationService {
  private sequences: Map<string, Promise<ThreeSequence>> = new Map()
  private avatarAnimationManagers: Map<
    string,
    Promise<AvatarAnimationManager>
  > = new Map()
  private sequenceParserOpts: any = {fileType: FileType.AUTO, fflate}
  private frameRate = 60

  constructor(private engine: EngineService, private objSvc: ObjectService) {
    engine.maxFps.subscribe((fps) => {
      this.setFrameRate(fps)
    })
  }

  public loadSequence(name: string, uri: string) {
    if (this.sequences.get(name) !== undefined) {
      return this.sequences.get(name)
    } else {
      const promise = parseSequence(uri, this.sequenceParserOpts)
        .then(async (seq: any) =>
          this.toThreeAndInterpolate(seq, this.frameRate)
        )
        .catch((_) => {
          // This sequence name is considered invalid, so keeping a null entry in the registry map
          // ensures us the service won't try to load it each time it is referenced
          this.sequences.set(name, null)
        })
      this.sequences.set(name, promise)
      return promise
    }
  }

  public getAvatarAnimationManager(
    name: string,
    implicit: Map<string, string>,
    explicit: Map<string, string>,
    extension = '.zip'
  ) {
    if (this.avatarAnimationManagers.get(name) !== undefined) {
      return this.avatarAnimationManagers.get(name)
    } else {
      const mgrPromise = this.loadAvatarAnimationManager(
        name,
        implicit,
        explicit,
        extension
      )
      this.avatarAnimationManagers.set(name, mgrPromise)
      return mgrPromise
    }
  }

  public setFrameRate(frameRate: number) {
    this.frameRate = frameRate

    if (!this.sequences) {
      return
    }

    /* Update existing sequences */
    for (const entry of this.sequences) {
      entry[1].then((seq) => {
        if (seq.frameRate > frameRate) {
          return
        }

        const newSeq = this.toThreeAndInterpolate(seq.original, frameRate)
        seq.frames = newSeq.frames
        seq.frameRate = newSeq.frameRate
        seq.keyFrameIDs = newSeq.keyFrameIDs
      })
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
    extension
  ) {
    const implicitSequences = new Map<string, ThreeSequence>()
    const explicitSequences = new Map<string, ThreeSequence>()

    for (const [key, filename] of implicit) {
      try {
        const seq = await this.loadSequence(
          filename,
          `${this.objSvc.path.value}/seqs/${filename}${extension}`
        )
        implicitSequences.set(key, seq)
      } catch (e) {
        implicitSequences.set(key, null)
      }
    }

    for (const [key, filename] of explicit) {
      try {
        const seq = await this.loadSequence(
          filename,
          `${this.objSvc.path.value}/seqs/${filename}${extension}`
        )
        explicitSequences.set(key, seq)
      } catch (e) {
        explicitSequences.set(key, null)
      }
    }

    return new AvatarAnimationManager(
      name,
      implicitSequences,
      explicitSequences
    )
  }

  private toThreeAndInterpolate(
    sequence: any,
    targetFrameRate: number = 30
  ): ThreeSequence {
    return this.interpolate(
      this.maybeUpscale(this.toThree(sequence), targetFrameRate)
    )
  }

  private toThree(sequence: any): ThreeSequence {
    const threeFrames: any[] = []
    const keyFrameIDs: number[] = []
    const rootJointTag: number = getJointTag(sequence.rootJointName) || 1
    const nbFrames: number = sequence.totalNFrames

    for (let i = 0; i < nbFrames; i++) {
      threeFrames.push({joints: {}, location: new Vector3(0.0, 0.0, 0.0)})
    }

    for (const [frameId, frame] of Object.entries(sequence.frames) as any) {
      if (frame === undefined) {
        continue
      }

      const fId: number = parseInt(frameId, 10) - 1

      if (fId >= nbFrames || fId < 0) {
        continue
      }

      const location: number[] = frame.location || [0.0, 0.0, 0.0]
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

  private maybeUpscale(sequence: ThreeSequence, targetFrameRate: number) {
    if (sequence.frameRate >= targetFrameRate) {
      return sequence
    }

    const ratio = targetFrameRate / sequence.frameRate
    const threeFrames = []
    const keyFrameIDs = []

    for (let i = 0, len = sequence.frames.length * ratio; i < len; i++) {
      threeFrames.push({joints: {}, location: new Vector3(0.0, 0.0, 0.0)})
    }

    sequence.keyFrameIDs.forEach((id) => {
      const newId = Math.floor(id * ratio)
      keyFrameIDs.push(newId)
      threeFrames[newId] = sequence.frames[id]
    })

    return {
      original: sequence.original,
      frameRate: targetFrameRate,
      frames: threeFrames,
      rootJointTag: sequence.rootJointTag,
      keyFrameIDs
    }
  }

  private interpolate(threeSeq: ThreeSequence): ThreeSequence {
    // Fill the gap between each key frame (if any)
    for (let i = 0, len = threeSeq.keyFrameIDs.length; i < len - 1; i++) {
      const firstKeyId = threeSeq.keyFrameIDs[i]
      const secondKeyId = threeSeq.keyFrameIDs[i + 1]
      interpolateThreeFrames(threeSeq.frames, firstKeyId, secondKeyId)
    }

    return threeSeq
  }
}
