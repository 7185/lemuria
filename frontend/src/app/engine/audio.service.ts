import {Injectable} from '@angular/core'
import type {PerspectiveCamera} from 'three'
import {Audio, AudioListener} from 'three'

@Injectable({
  providedIn: 'root'
})
export class AudioService {
  private audioListener = new AudioListener()
  private bgAudio = new Audio(this.audioListener)
  private audio = new Audio(this.audioListener)
  bgUrl = ''

  addListener(camera: PerspectiveCamera) {
    camera.add(this.audioListener)
  }

  setSoundVolume(volume: number) {
    if (this.bgAudio.isPlaying) {
      this.bgAudio.setVolume(volume)
    }
  }

  playSound(buffer: AudioBuffer, volume: number) {
    this.stopSound()
    this.bgAudio.setBuffer(buffer)
    this.bgAudio.setLoop(true)
    this.bgAudio.setVolume(volume)
    this.bgAudio.play()
  }

  stopSound() {
    if (this.bgAudio.isPlaying) {
      this.bgAudio.stop()
      this.bgUrl = ''
    }
  }

  playNoise(buffer: AudioBuffer) {
    if (this.audio.isPlaying) {
      return
    }
    this.audio.setBuffer(buffer)
    this.audio.setLoop(false)
    this.audio.setVolume(1)
    this.audio.play()
  }
}
