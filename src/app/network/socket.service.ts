import {Injectable} from '@angular/core'
import {Subject} from 'rxjs'
import {webSocket, WebSocketSubject} from 'rxjs/webSocket'
import {config} from '../app.config'

@Injectable({providedIn: 'root'})
export class SocketService {
  private socket: WebSocketSubject<any> = webSocket({url: config.url.websocket})

  public messages: Subject<any> = new Subject()
  public connected = false

  connect() {
    this.socket.subscribe(msg => {
      this.connected = true
      this.messages.next(msg)
    }, err => {
      this.messages.next({type: 'err', data: 'Connection lost'})
      this.connected = false
    })
  }

  sendMessage(msg: any) {
    this.socket.next(msg)
  }

  close() {
    this.socket.complete()
    this.connected = false
  }
}
