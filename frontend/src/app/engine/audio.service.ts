import {Injectable} from '@angular/core'
import {Audio, AudioListener, AudioLoader} from 'three'

@Injectable({
  providedIn: 'root'
})
export class AudioService {
  private audioListener = new AudioListener()
  private audioLoader = new AudioLoader()
  private bgAudio = new Audio(this.audioListener)
  private audio = new Audio(this.audioListener)
  private bgUrl = ''

  public addListener(camera) {
    camera.add(this.audioListener)
  }

  public playSound(url: string, volume: number) {
    if (url === this.bgUrl) {
      this.bgAudio.setVolume(volume)
      return
    }
    this.stopSound()
    this.bgUrl = url
    this.audioLoader.load(url, (buffer) => {
      this.bgAudio.setBuffer(buffer)
      this.bgAudio.setLoop(true)
      this.bgAudio.setVolume(volume)
      this.bgAudio.play()
    })
  }

  public stopSound() {
    if (this.bgAudio.isPlaying) {
      this.bgAudio.stop()
      this.bgUrl = ''
    }
  }

  public playNoise(url: string) {
    if (this.audio.isPlaying) {
      return
    }
    this.audioLoader.load(url, (buffer) => {
      this.audio.setBuffer(buffer)
      this.audio.setLoop(false)
      this.audio.setVolume(1)
      this.audio.play()
    })
  }
}
