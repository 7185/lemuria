import {EngineService} from './../engine/engine.service'
import {UserService} from './../user/user.service'
import {Injectable} from '@angular/core'
import {interval, Subject, Subscription} from 'rxjs'
import {webSocket, WebSocketSubject} from 'rxjs/webSocket'
import {Vector3} from 'three'
import {config} from '../app.config'

@Injectable({providedIn: 'root'})
export class SocketService {
  public messages: Subject<any> = new Subject()
  public connected = false

  private socket: WebSocketSubject<any> = webSocket({url: config.url.websocket})
  private posTimer: Subscription
  private lastSentPos = [new Vector3(), new Vector3()]

  constructor(private engineSvc: EngineService, private userSvc: UserService) {}

  connect() {
    if (!this.connected) {
      this.socket.subscribe(msg => {
        this.connected = true
        this.handleMessage(msg)
      }, err => {
        this.messages.next({type: 'err', data: 'Connection lost'})
        this.disconnect()
      }, () => {
        this.messages.next({type: 'err', data: 'Disconnected'})
        this.disconnect()
      })
      this.posTimer = interval(200).subscribe(() => {
        const pos: [Vector3, Vector3] = [new Vector3(), new Vector3()]
        for (const [i, vec] of this.engineSvc.getPosition().entries()) {
          for (const [a, v] of Object.entries(vec)) {
            pos[i][a] = +v.toFixed(2)
          }
        }
        if (!(this.lastSentPos[0].equals(pos[0]) && this.lastSentPos[1].equals(pos[1]))) {
          this.sendMessage({type: 'pos', data: {pos: pos[0], ori: pos[1]}})
          this.lastSentPos[0].copy(pos[0])
          this.lastSentPos[1].copy(pos[1])
        }
      })
    }
  }

  handleMessage(msg: any) {
    if (msg.type === 'list') {
      this.userSvc.refreshList(msg.data)
    } else if (msg.type === 'pos') {
      this.userSvc.setPosition(msg.user, [msg.data.pos, msg.data.ori])
    } else if (msg.type === 'avatar') {
      this.userSvc.setAvatar(msg.user, msg.data)
    } else {
      this.messages.next(msg)
    }
  }

  sendMessage(msg: any) {
    if (this.connected) {
      this.socket.next(msg)
    }
  }

  disconnect() {
    this.userSvc.clearList()
    this.posTimer.unsubscribe()
    this.connected = false
  }

  close() {
    this.socket.complete()
    this.disconnect()
  }
}
