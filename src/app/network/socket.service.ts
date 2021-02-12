import {Injectable} from '@angular/core'
import {webSocket, WebSocketSubject} from 'rxjs/webSocket'
import {config} from '../app.config'

@Injectable({providedIn: 'root'})
export class SocketService {
  private socket: WebSocketSubject<any> = webSocket({url: config.url.websocket})

  connect() {
    return this.socket
  }

  sendMessage(msg: any) {
    this.socket.next(msg)
  }
  close() {
    this.socket.complete()
  }
}
