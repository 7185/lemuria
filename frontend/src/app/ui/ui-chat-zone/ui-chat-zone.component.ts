import {Component, ViewChild} from '@angular/core'
import type {OnInit} from '@angular/core'
import {VirtualScrollerComponent} from '@floogulinc/ngx-virtual-scroller'
import {SocketService} from '../../network/socket.service'
import {UserService} from '../../user/user.service'

@Component({
  selector: 'app-ui-chat-zone',
  templateUrl: './ui-chat-zone.component.html',
  styleUrls: ['./ui-chat-zone.component.scss']
})
export class UiChatZoneComponent implements OnInit {


  @ViewChild(VirtualScrollerComponent)
  private virtualScroller: VirtualScrollerComponent

  public data = []
  public message = ''
  public chatActive = false
  public colors = {}

  public constructor(public socket: SocketService, public usrSvc: UserService) {
  }

  public activeChat() {
    this.chatActive = !this.chatActive
  }

  public send(): void {
    if (this.message.length) {
      this.socket.sendMessage({type: 'msg', data: this.message})
      this.message = ''
    }
  }

  public ngOnInit(): void {
    this.socket.messages.subscribe(msg => {
      if (['msg', 'err', 'join', 'part', 'info'].indexOf(msg.type) > -1) {
        for (const u of this.usrSvc.userList) {
          this.colors[u.name] = '#' + u.id.substring(0, 6)
        }
        this.data.push(msg)
        this.virtualScroller.scrollInto(msg)
      }
    })
  }
}
