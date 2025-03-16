import type {Group} from 'three'
import type {ThreeSequence} from './avatar-animation.service'
import {AvatarAnimationPlayer} from './avatar-animation.player'

export class AvatarAnimationManager {
  public name: string
  public implicitSequences: Map<string, ThreeSequence>
  public explicitSequences: Map<string, ThreeSequence>

  constructor(
    name: string,
    implicitSequences: Map<string, ThreeSequence>,
    explicitSequences: Map<string, ThreeSequence>
  ) {
    this.name = name
    this.implicitSequences = implicitSequences
    this.explicitSequences = explicitSequences
  }

  spawnAnimationPlayer(avatar: Group) {
    return new AvatarAnimationPlayer(this, avatar)
  }
}
