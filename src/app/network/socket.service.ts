import {EngineService} from './../engine/engine.service'
import {UserService} from './../user/user.service'
import {Injectable} from '@angular/core'
import {interval, Subject, Subscription} from 'rxjs'
import {webSocket, WebSocketSubject} from 'rxjs/webSocket'
import {Vector3} from 'three'
import {config} from '../app.config'
import {User} from '../user/user.model'

@Injectable({providedIn: 'root'})
export class SocketService {
  public messages: Subject<any> = new Subject()
  public connected = false

  private socket: WebSocketSubject<any> = webSocket({url: config.url.websocket})
  private posTimer: Subscription
  private lastSentPos = new Vector3()

  constructor(private engineSvc: EngineService, private userSvc: UserService) {}

  connect() {
    if (!this.connected) {
      this.socket.subscribe(msg => {
        this.connected = true
        this.handleMessage(msg)
      }, err => {
        this.posTimer.unsubscribe()
        this.messages.next({type: 'err', data: 'Connection lost'})
        this.connected = false
      }, () => {
        this.posTimer.unsubscribe()
        this.messages.next({type: 'err', data: 'Disconnected'})
        this.connected = false
      })
      this.posTimer = interval(200).subscribe(() => {
        const pos = this.engineSvc.getPosition()
        if (!this.lastSentPos.equals(pos)) {
          this.sendMessage({type: 'pos', data: pos})
          this.lastSentPos.copy(pos)
        }
      })
    }
  }

  handleMessage(msg: any) {
    if (msg.type === 'list') {
      this.userSvc.userList = []
      for (const u of msg.data) {
        this.userSvc.userList.push(new User({id: u.id, name: u.name}))
      }
    } else if (msg.type === 'pos') {
      this.userSvc.setPosition(msg.user, msg.data)
    } else {
      this.messages.next(msg)
    }
  }

  sendMessage(msg: any) {
    if (this.connected) {
      this.socket.next(msg)
    }
  }

  close() {
    this.posTimer.unsubscribe()
    this.socket.complete()
    this.connected = false
  }
}
