import {Injectable, signal} from '@angular/core'

@Injectable({
  providedIn: 'root'
})
export class TeleportService {
  teleportHistory = []
  currentTeleportIndex = 0
  teleport = signal<{
    world: string | null
    position: string | null
    isNew: boolean | null
  }>({
    world: 'Nowhere',
    position: '0N 0W',
    isNew: false
  })
  private lastTeleportIndex = -1

  teleportFrom(world: string = null, position: string = null, isNew = false) {
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
      return
    }
    this.teleportHistory[this.lastTeleportIndex] = {world, position}
  }

  teleportBack() {
    if (this.currentTeleportIndex <= 0) {
      return
    }

    this.lastTeleportIndex = this.currentTeleportIndex
    this.currentTeleportIndex--
    this.teleport.set(this.teleportHistory[this.currentTeleportIndex])
  }

  teleportNext() {
    if (this.currentTeleportIndex >= this.teleportHistory.length - 1) {
      return
    }

    this.lastTeleportIndex = this.currentTeleportIndex
    this.currentTeleportIndex++
    this.teleport.set(this.teleportHistory[this.currentTeleportIndex])
  }
}
