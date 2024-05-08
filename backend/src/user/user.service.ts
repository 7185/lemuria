import {Injectable} from '@nestjs/common'
import {JwtService} from '@nestjs/jwt'
import {randomUUID} from 'crypto'
import {Message} from 'src/ws/ws.gateway'
import {User} from './user'
import {config} from '../app.config'

@Injectable()
export class UserService {
  authorizedUsers = new Set<User>()
  private cookieAccessRegex = new RegExp(`${config.cookie.accessName}=([^;]+)`)
  private cookieRefreshRegex = new RegExp(
    `${config.cookie.refreshName}=([^;]+)`
  )

  constructor(private readonly jwtService: JwtService) {}

  login(username: string) {
    const userId = randomUUID().substring(0, 8)
    const user = new User({
      id: userId,
      name: username || `Anonymous${userId}`
    })
    this.authorizedUsers.add(user)
    return {id: user.id, name: user.name}
  }

  logout(userId: string | null) {
    this.authorizedUsers.forEach((u) =>
      u.id === userId ? this.authorizedUsers.delete(u) : u
    )
    return {}
  }

  getUser(userId: string) {
    for (const user of this.authorizedUsers) {
      if (user.id === userId) {
        return user
      }
    }
    return new User()
  }

  getUserFromAccessCookie(cookie: string) {
    return this.getUserFromCookie(cookie, this.cookieAccessRegex)
  }

  getUserFromRefreshCookie(cookie: string) {
    return this.getUserFromCookie(cookie, this.cookieRefreshRegex)
  }

  broadcast(message: Message) {
    Array.from(this.authorizedUsers)
      .filter((user) => user.connected)
      .forEach((user) => {
        user.websockets.forEach((socket) => {
          socket.send(JSON.stringify(message))
        })
      })
  }

  broadcastUserlist() {
    this.broadcast({
      type: 'list',
      data: Array.from(this.authorizedUsers)
        .filter((user: User) => user.connected)
        .map((user: User) => user.toDict())
    })
  }

  broadcastWorld(world: number, message: Message) {
    Array.from(this.authorizedUsers)
      .filter((user) => user.connected && user.world === world)
      .forEach((user) => {
        for (const socket of user.websockets) {
          if (message.type === 'pos' && message.user === user.id) {
            continue
          }
          socket.send(JSON.stringify(message))
        }
      })
  }

  sendPosition(user: User) {
    this.broadcastWorld(user.world, {
      type: 'pos',
      user: user.id,
      data: {
        pos: {x: user.position[0], y: user.position[1], z: user.position[2]},
        ori: {
          x: user.orientation[0],
          y: user.orientation[1],
          z: user.orientation[2]
        },
        state: user.state,
        gesture: user.gesture
      }
    })
  }

  private getUserFromCookie(cookie: string, regex: RegExp) {
    const authCookie = regex?.exec(cookie)
    if (authCookie) {
      try {
        const userId = this.jwtService.verify(authCookie[1])['id']
        return this.getUser(userId)
      } catch (error) {
        return new User()
      }
    }
    return new User()
  }
}
