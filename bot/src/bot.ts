import WebSocket from 'ws'
import axios, {AxiosResponse} from 'axios'

const AUTH_COOKIE = 'lemuria_token_access'
const DEBUG = false

interface UserData {
  id: string
  name: string
  avatar: number
  world: number
}

interface WorldData {
  id: number
  name: string
  users: number
}

class User {
  name: string
  world: number
  x: number
  y: number
  z: number
  roll: number
  yaw: number
  pitch: number
  avatar: number
  state: string
  gesture: string | null

  constructor(name: string = '') {
    this.name = name
    this.world = 0
    this.x = 0.0
    this.y = 0.0
    this.z = 0.0
    this.roll = 0.0
    this.yaw = 0.0
    this.pitch = 0.0
    this.avatar = 0
    this.state = 'idle'
    this.gesture = null
  }

  setPosition(
    x: number = 0.0,
    y: number = 0.0,
    z: number = 0.0,
    roll: number = 0.0,
    yaw: number = 0.0,
    pitch: number = 0.0
  ): void {
    this.x = x
    this.y = y
    this.z = z
    this.roll = roll
    this.yaw = yaw
    this.pitch = pitch
  }
}

class Bot extends User {
  webUrl: string
  wsUrl: string
  ws: WebSocket | null
  loggingEnabled: boolean
  connected: boolean
  handlers: Record<string, any>
  userlist: Record<string, User>
  worldlist: Record<number, {name: string; users: number}>
  cookiejar: Record<string, string>

  constructor(webUrl: string, wsUrl: string, loggingEnabled: boolean = true) {
    super()
    this.webUrl = webUrl
    this.wsUrl = wsUrl
    this.ws = null
    this.loggingEnabled = loggingEnabled
    this.connected = false
    this.handlers = {}
    this.userlist = {}
    this.worldlist = {}
    this.cookiejar = {}
  }

  log(txt: string): void {
    if (!this.loggingEnabled) {
      return
    }
    console.log(txt)
  }

  async _callback(name: string, ...parameters: any[]): Promise<void> {
    const instances = [this, ...Object.values(this.handlers)]
    for (const inst of instances) {
      const f = (inst as any)[name]
      if (typeof f !== 'function') continue
      if (DEBUG) {
        this.log(`calling ${name}() on instance ${inst}`)
      }
      if (f) {
        await f.apply(inst, parameters)
      }
    }
  }

  async _processMsg(msg: any): Promise<void> {
    this.log(`> ${JSON.stringify(msg)}`)

    if (!msg.type) {
      this.log('* unknown message')
      return
    }

    const t = msg.type

    switch (t) {
      case 'avatar':
        const user = this.userlist[msg.user]
        if (user) {
          user.avatar = msg.data
        }
        await this._callback('on_user_avatar', msg.user, msg.data)
        break
      case 'join':
        await this._callback('on_user_join', msg.data)
        break
      case 'list':
        this.userlist = {}
        for (const u of msg.data as UserData[]) {
          const user = new User(u.name)
          user.avatar = u.avatar
          user.world = u.world
          this.userlist[u.id] = user
        }
        await this._callback('on_user_list')
        break
      case 'msg':
        await this._callback('on_msg', msg.user, msg.data)
        break
      case 'part':
        await this._callback('on_user_part', msg.data)
        break
      case 'pos':
        const posUser = this.userlist[msg.user]
        if (posUser) {
          const data = msg.data
          posUser.x = data.pos.x
          posUser.y = data.pos.y
          posUser.z = data.pos.z
          posUser.roll = data.ori.x
          posUser.yaw = data.ori.y
          posUser.pitch = data.ori.z
          posUser.state = data.state
          posUser.gesture = data.gesture
        }
        await this._callback('on_user_pos', msg.user, msg.data)
        break
    }
  }

  async send(msg: any): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg))
      this.log(`< ${JSON.stringify(msg)}`)
    } else {
      this.log('* WebSocket not initialized or not open')
    }
  }

  async sendMsg(msg: string): Promise<void> {
    await this.send({type: 'msg', data: msg})
    await this._callback('on_self_msg', msg)
  }

  async sendPosition(): Promise<void> {
    await this.send({
      type: 'pos',
      data: {
        pos: {
          x: Number(this.x.toFixed(2)),
          y: Number(this.y.toFixed(2)),
          z: Number(this.z.toFixed(2))
        },
        ori: {
          x: Math.round(this.roll),
          y: Math.round(this.yaw),
          z: Math.round(this.pitch)
        },
        state: this.state,
        gesture: this.gesture
      }
    })
  }

  async changeAvatar(avatar: number): Promise<void> {
    this.avatar = avatar
    await this.send({type: 'avatar', data: this.avatar})
  }

  async login(): Promise<void> {
    try {
      const response: AxiosResponse = await axios.post(`${this.webUrl}/auth/`, {
        login: this.name,
        password: 'password'
      })
      const cookie = response.headers['set-cookie']?.find((cookie) =>
        cookie.startsWith(AUTH_COOKIE)
      )
      if (cookie) {
        this.cookiejar[AUTH_COOKIE] = cookie.split(';')[0].split('=')[1]
      }
    } catch (error) {
      console.error('Login failed:', error)
    }
  }

  async getWorldList(): Promise<void> {
    try {
      const response: AxiosResponse<WorldData[]> = await axios.get(
        `${this.webUrl}/world/`,
        {
          headers: {Cookie: `${AUTH_COOKIE}=${this.cookiejar[AUTH_COOKIE]}`}
        }
      )
      this.worldlist = {}
      for (const w of response.data) {
        this.worldlist[w.id] = {name: w.name, users: w.users}
      }
    } catch (error) {
      console.error('Failed to get world list:', error)
    }
  }

  async worldEnter(worldId: number): Promise<void> {
    try {
      const response: AxiosResponse<{id: number}> = await axios.get(
        `${this.webUrl}/world/${worldId}`,
        {
          headers: {Cookie: `${AUTH_COOKIE}=${this.cookiejar[AUTH_COOKIE]}`}
        }
      )
      this.world = response.data.id
    } catch (error) {
      console.error('Failed to enter world:', error)
    }
  }

  async connect(): Promise<void> {
    await this.login()
    await this.getWorldList()

    this.ws = new WebSocket(this.wsUrl, {
      headers: {Cookie: `${AUTH_COOKIE}=${this.cookiejar[AUTH_COOKIE]}`}
    })

    this.ws.on('open', async () => {
      this.log('@ Connected')
      this.connected = true
      await this._callback('on_connected')
    })

    this.ws.on('message', async (data: WebSocket.Data) => {
      const msg = JSON.parse(data.toString())
      await this._processMsg(msg)
    })

    this.ws.on('close', async () => {
      this.connected = false
      this.log('@ Disconnected')
      await this._callback('on_disconnected')
    })

    this.ws.on('error', (error: Error) => {
      console.error('WebSocket error:', error)
    })
  }

  run(): void {
    this.connect().catch(console.error)
  }
}

export {User, Bot}
