import type {Group} from 'three'
import type {ThreeSequence} from './avatar-animation.service'
import {AvatarAnimationPlayer} from './avatar-animation.player'

export class AvatarAnimationManager {
  constructor(
    public name: string,
    public implicitSequences: Map<string, ThreeSequence>,
    public explicitSequences: Map<string, ThreeSequence>
  ) {}

  spawnAnimationPlayer(avatar: Group) {
    return new AvatarAnimationPlayer(this, avatar)
  }
}
