import {Injectable} from '@angular/core'
import {Audio, AudioListener} from 'three'

@Injectable({
  providedIn: 'root'
})
export class AudioService {
  private audioListener = new AudioListener()
  private bgAudio = new Audio(this.audioListener)
  private audio = new Audio(this.audioListener)
  public bgUrl = ''

  public addListener(camera) {
    camera.add(this.audioListener)
  }

  public setSoundVolume(volume: number) {
    if (this.bgAudio.isPlaying) {
      this.bgAudio.setVolume(volume)
    }
  }

  public playSound(buffer: AudioBuffer, url: string, volume: number) {
    this.stopSound()
    this.bgAudio.setBuffer(buffer)
    this.bgAudio.setLoop(true)
    this.bgAudio.setVolume(volume)
    this.bgAudio.play()
  }

  public stopSound() {
    if (this.bgAudio.isPlaying) {
      this.bgAudio.stop()
      this.bgUrl = ''
    }
  }

  public playNoise(buffer: AudioBuffer) {
    if (this.audio.isPlaying) {
      return
    }
    this.audio.setBuffer(buffer)
    this.audio.setLoop(false)
    this.audio.setVolume(1)
    this.audio.play()
  }
}
