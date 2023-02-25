import {WebSocketServer, WebSocketGateway} from '@nestjs/websockets'
import {JwtService} from '@nestjs/jwt'
import type {IncomingMessage} from 'http'
import {Server, WebSocket} from 'ws'
import {UserService} from '../user/user.service'
import {config} from '../app.config'

export interface Message {
  type: string
  user?: string
  data: any
}

@WebSocketGateway({path: '/api/v1/ws'})
export class WsGateway {
  @WebSocketServer() server: Server

  private cookieRegex = new RegExp(`${config.cookie.access}=([^;]+)`)

  constructor(
    private readonly userSvc: UserService,
    private readonly jwtService: JwtService
  ) {}

  afterInit() {
    this.server.on(
      'connection',
      (client: WebSocket, request: IncomingMessage) => {
        const accessCookie = request.headers.cookie?.match(this.cookieRegex)
        if (!accessCookie) {
          client.close()
          return
        }
        const userId = this.jwtService.decode(accessCookie[1])['id']
        const user = this.userSvc.getUser(userId)
        client.on('message', (payload: string) => {
          const message = JSON.parse(payload)
          // handle client message
          switch (message.type) {
            case 'msg':
              this.userSvc.broadcast({
                type: 'msg',
                user: user.name,
                data: message.data
              })
              break
            case 'pos':
              user.position = [
                message.data.pos.x,
                message.data.pos.y,
                message.data.pos.z
              ]
              user.orientation = [
                message.data.ori.x,
                message.data.ori.y,
                message.data.ori.z
              ]
              break
            case 'avatar':
              user.avatar = message.data
              break
            default:
              console.log('Unknown message type:', message.type)
              break
          }
        })
      }
    )
  }

  handleConnection(client: WebSocket, request: IncomingMessage) {
    const accessCookie = request.headers.cookie?.match(this.cookieRegex)
    if (!accessCookie) {
      client.close()
      return
    }
    const userId = this.jwtService.decode(accessCookie[1])['id']
    const user = this.userSvc.getUser(userId)
    if (user.id) {
      client.close()
      return
    }
    user.websockets.add(client)
    user.connected = true
    this.userSvc.broadcast({type: 'join', data: user.name})
    this.userSvc.broadcastUserlist()
  }

  handleDisconnect(client: any) {
    for (const user of this.userSvc.authorizedUsers) {
      for (const websocket of user.websockets) {
        if (websocket === client) {
          user.websockets.delete(client)
          if (user.websockets.size === 0) {
            user.connected = false
          }
        }
      }
    }
  }
}
