import {EngineService} from '../engine/engine.service'
import {UserService} from '../user'
import {inject, Injectable} from '@angular/core'
import {interval, Subject} from 'rxjs'
import type {Subscription} from 'rxjs'
import {webSocket} from 'rxjs/webSocket'
import type {WebSocketSubject} from 'rxjs/webSocket'
import {Vector3} from 'three'
import {environment} from '../../environments/environment'

interface Message {
  type: string
  user?: string
  data?: any
}

@Injectable({providedIn: 'root'})
export class SocketService {
  messages: Subject<Message> = new Subject()
  connected = false

  private readonly engineSvc = inject(EngineService)
  private readonly userSvc = inject(UserService)
  private connecting = false
  private socket: WebSocketSubject<unknown> = webSocket({
    url: environment.url.websocket
  })
  private posTimer: Subscription
  private lastSentPos = [new Vector3(), new Vector3()]
  private lastSentGesture: string = null
  private lastSentState: string = null

  connect() {
    if (this.connected || this.connecting) {
      return
    }
    this.connecting = true
    this.socket.subscribe({
      next: (msg: Message) => {
        this.connected = true
        this.connecting = false
        this.handleMessage(msg)
      },
      error: () => {
        this.messages.next({type: 'err', data: 'Connection lost'})
        this.disconnect()
      },
      complete: () => {
        this.messages.next({type: 'err', data: 'Disconnected'})
        this.disconnect()
      }
    })
    this.posTimer = interval(200).subscribe(() => {
      const pos: [Vector3, Vector3] = [new Vector3(), new Vector3()]
      const {gesture, state} = this.engineSvc

      for (const [i, vec] of this.engineSvc.position.entries()) {
        pos[i].fromArray(vec.toArray().map((v) => +v.toFixed(2)))
      }

      if (
        !this.lastSentPos[0].equals(pos[0]) ||
        !this.lastSentPos[1].equals(pos[1]) ||
        gesture !== this.lastSentGesture ||
        state !== this.lastSentState
      ) {
        this.sendMessage({
          type: 'pos',
          data: {
            pos: pos[0],
            ori: pos[1],
            state,
            gesture
          }
        })
        this.lastSentPos[0].copy(pos[0])
        this.lastSentPos[1].copy(pos[1])
        this.lastSentGesture = gesture
        this.lastSentState = state
      }
    })
  }

  handleMessage(msg: Message) {
    if (msg.type === 'list') {
      this.userSvc.refreshList(msg.data)
    } else if (msg.type === 'pos') {
      this.userSvc.setPosition(
        msg.user,
        [msg.data.pos, msg.data.ori],
        msg.data.state,
        msg.data.gesture
      )
    } else if (msg.type === 'avatar') {
      this.userSvc.setAvatar(msg.user, msg.data)
    } else {
      this.messages.next(msg)
    }
  }

  sendMessage(msg: Message) {
    if (this.connected) {
      this.socket.next(msg)
    }
  }

  disconnect() {
    this.connected = false
    this.connecting = false
    this.userSvc.clearList()
    this.posTimer.unsubscribe()
  }

  close() {
    this.socket.complete()
    this.disconnect()
  }
}
