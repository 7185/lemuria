import {Bot} from './bot.ts'
import {setTimeout} from 'timers/promises'

const WEB_URL = 'https://lemuria.7185.fr/api/v1'
const WS_URL = 'wss://lemuria.7185.fr/api/v1/ws'

class Bonobot extends Bot {
  following: string | null
  moveSpeed: number
  currentMoveThread: number

  constructor(webUrl: string, wsUrl: string) {
    super(webUrl, wsUrl, false) // loggingEnabled set to false
    this.name = '[bonobot]'
    this.following = null
    this.moveSpeed = 1
    this.currentMoveThread = 0
  }

  async move(destX: number, destZ: number): Promise<void> {
    const threadId = this.currentMoveThread
    const tick = 200
    const dx = destX - this.x
    const dz = destZ - this.z
    const length = Math.sqrt(dx ** 2 + dz ** 2)
    const direction = Math.atan2(dx, dz) + Math.PI
    this.state = 'walk'
    const numStep = Math.floor(length * (1 / this.moveSpeed))
    let gaps: [number, number][]
    if (numStep > 0) {
      const xGap = dx / numStep
      const zGap = dz / numStep
      gaps = Array.from({length: numStep}, (_, i) => [
        this.x + (i + 1) * xGap,
        this.z + (i + 1) * zGap
      ])
    } else {
      gaps = [[destX, destZ]]
    }
    for (const [stepX, stepZ] of gaps) {
      if (threadId !== this.currentMoveThread) {
        break
      }
      this.setPosition(stepX, this.y, stepZ, 0, direction, 0)
      await this.sendPosition()
      await setTimeout(tick)
    }
    this.state = 'idle'
    await this.sendPosition()
  }

  async on_connected(): Promise<void> {
    await this.changeAvatar(this.avatar)
    await this.getWorldList()
    for (const [i, w] of Object.entries(this.worldlist)) {
      if (w.name === 'Village') {
        await this.worldEnter(parseInt(i))
        break
      }
    }
    await this.sendMsg('hello')
    await this.sendPosition()
  }

  async on_user_join(msg: string): Promise<void> {
    const user = this.userlist[msg]
    console.log(
      `[${new Date().toISOString()}] * ${user ? user.name : msg} joined`
    )
  }

  async on_user_part(msg: string): Promise<void> {
    const user = this.userlist[msg]
    console.log(
      `[${new Date().toISOString()}] * ${user ? user.name : msg} left`
    )
  }

  async on_msg(userId: string, msg: string): Promise<void> {
    const user = this.userlist[userId]
    console.log(
      `[${new Date().toISOString()}] <${user ? user.name : msg}> ${msg}`
    )

    if (user?.name === this.name) {
      return
    }

    const [command, ...args] = msg.split(' ')

    switch (command) {
      case '!list': {
        const l = Object.entries(this.userlist)
          .map(([i, u]) => `${u.name}(${u.avatar}:${i})`)
          .join(' ')
        await this.sendMsg(l)
        break
      }
      case '!pos':
        await this.sendMsg(`${this.x},${this.y},${this.z}`)
        break
      case '!come': {
        if (!user) {
          await this.sendMsg("Sorry, I don't know who you are.")
        } else if (user.world !== this.world) {
          const worldName = this.world
            ? this.worldlist[this.world]?.name
            : 'Nowhere'
          await this.sendMsg(`Sorry, I'm on ${worldName}...`)
        } else {
          await this.sendMsg('Coming...')
          this.currentMoveThread++
          this.move(user.x, user.z).catch(console.error)
        }
        break
      }
      case '!whereami': {
        if (!user) {
          await this.sendMsg("Sorry, I don't know who you are.")
        } else {
          await this.sendMsg(`${user.x},${user.y},${user.z}`)
        }
        break
      }
      case '!speed': {
        this.moveSpeed = parseInt(args[0]) || 1
        await this.sendMsg(`Running at ${this.moveSpeed}`)
        break
      }
      case '!change':
        await this.changeAvatar(Math.floor(Math.random() * 17))
        break
    }
  }
}

const b = new Bonobot(WEB_URL, WS_URL)
b.run()
