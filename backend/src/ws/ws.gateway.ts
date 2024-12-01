import {WebSocketGateway, WebSocketServer} from '@nestjs/websockets'
import {noop, timer} from 'rxjs'
import type {IncomingMessage} from 'http'
import {Server, WebSocket} from 'ws'
import {UserService} from '../user/user.service'
import {config} from '../app.config'

export interface Message {
  type: string
  user?: string | null
  data: any
}

@WebSocketGateway({path: '/api/v1/ws'})
export class WsGateway {
  @WebSocketServer()
  server: Server
  constructor(private readonly userSvc: UserService) {}

  afterInit() {
    this.server.on(
      'connection',
      (client: WebSocket, request: IncomingMessage) => {
        const user = this.userSvc.getUserFromAccessCookie(
          request.headers.cookie ?? ''
        )
        if (!user.id) {
          client.close()
          return
        }
        client.on('message', (payload: string) => {
          const message: Message = JSON.parse(payload)
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
              user.state = message.data.state
              user.gesture = message.data.gesture
              break
            case 'avatar':
              user.avatar = message.data
              this.userSvc.broadcast({
                type: 'avatar',
                user: user.id,
                data: user.avatar
              })
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
    const user = this.userSvc.getUserFromAccessCookie(
      request.headers.cookie ?? ''
    )
    if (!user.id) {
      client.close()
      return
    }
    user.websockets.add(client)
    user.connected = true
    user.positionTimer = timer(0, config.positionUpdateTick).subscribe(() => {
      this.userSvc.sendPosition(user)
    })
    user.heartbeat = timer(0, config.heartbeatRate).subscribe(() => {
      client.ping(noop)
    })
    this.userSvc.broadcast({type: 'join', data: user.name})
    this.userSvc.broadcastUserlist()
  }

  handleDisconnect(client: any) {
    for (const user of this.userSvc.authorizedUsers) {
      for (const websocket of user.websockets) {
        if (websocket === client) {
          user.websockets.delete(client)
          if (user.websockets.size === 0) {
            user.positionTimer?.unsubscribe()
            user.heartbeat?.unsubscribe()
            user.connected = false
            this.userSvc.broadcast({
              type: 'part',
              data: user.name
            })
            this.userSvc.broadcastUserlist()
          }
        }
      }
    }
  }
}
