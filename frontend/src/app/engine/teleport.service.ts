import {Injectable} from '@angular/core'
import {Subject} from 'rxjs'

@Injectable({
  providedIn: 'root'
})
export class TeleportService {
  public teleportHistory = []
  public currentTeleportIndex = 0
  public teleportSubject = new Subject<{
    world: string | null
    position: string | null
    isNew: boolean | null
  }>()
  private lastTeleportIndex = -1

  constructor() {}

  teleportFrom(world = null, position = null, isNew = false) {
    if (world?.toLowerCase() === 'nowhere') {
      return
    }
    if (isNew) {
      // If the user teleports to a new position after hitting "back",
      // discard all the positions in the "next" stack
      this.teleportHistory.splice(this.currentTeleportIndex)
      this.lastTeleportIndex = this.currentTeleportIndex
      this.currentTeleportIndex++
      this.teleportHistory.push({world, position})
    } else {
      this.teleportHistory[this.lastTeleportIndex] = {world, position}
    }
  }

  teleportBack() {
    if (this.currentTeleportIndex > 0) {
      this.lastTeleportIndex = this.currentTeleportIndex
      this.currentTeleportIndex--
      this.teleportSubject.next(this.teleportHistory[this.currentTeleportIndex])
    }
  }

  teleportNext() {
    if (this.currentTeleportIndex < this.teleportHistory.length - 1) {
      this.lastTeleportIndex = this.currentTeleportIndex
      this.currentTeleportIndex++
      this.teleportSubject.next(this.teleportHistory[this.currentTeleportIndex])
    }
  }
}
