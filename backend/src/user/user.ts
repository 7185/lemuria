import type {WebSocket} from 'ws'

export class User {
  id?: string
  name?: string
  avatar?: number
  websockets?: Set<WebSocket>
  connected?: boolean
  position?: [number, number, number]
  orientation?: [number, number, number]
  world?: number
  state?: string
  gesture?: string | null

  constructor(params: User | object = {}) {
    this.id = null
    this.position = [0, 0, 0]
    this.orientation = [0, 0, 0]
    this.avatar = 0
    this.state = 'idle'
    this.gesture = null
    this.world = 0
    this.websockets = new Set()
    this.connected = false
    Object.assign(this, params)
  }

  public toDict() {
    return {
      id: this.id,
      name: this.name,
      avatar: this.avatar,
      world: this.world,
      state: this.state,
      gesture: this.gesture,
      x: this.position[0],
      y: this.position[1],
      z: this.position[2],
      roll: this.orientation[0],
      yaw: this.orientation[1],
      pitch: this.orientation[2]
    }
  }
}
