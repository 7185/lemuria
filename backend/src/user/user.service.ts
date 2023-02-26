import {Injectable} from '@nestjs/common'
import {JwtService} from '@nestjs/jwt'
import {randomUUID} from 'crypto'
import {Message} from 'src/ws/ws.gateway'
import {User} from './user'
import {config} from '../app.config'

@Injectable()
export class UserService {
  public authorizedUsers = new Set<User>()
  private cookieRegex = new RegExp(`${config.cookie.access}=([^;]+)`)

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

  logout() {
    // todo: remove user from authorizedUsers
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

  getUserFromCookie(cookie: string) {
    const accessCookie = cookie?.match(this.cookieRegex)
    if (accessCookie) {
      const userId = this.jwtService.decode(accessCookie[1])['id']
      return this.getUser(userId)
    }
    return new User()
  }

  broadcast(message: Message) {
    for (const user of this.authorizedUsers) {
      if (user.connected) {
        for (const socket of user.websockets) {
          socket.send(JSON.stringify(message))
        }
      }
    }
  }

  broadcastUserlist() {
    this.broadcast({
      type: 'list',
      data: Array.from(this.authorizedUsers.values())
        .filter((u) => u.connected)
        .map((u) => u.toDict())
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
}
