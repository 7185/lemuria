import {ChangeDetectionStrategy, Component, ViewChild} from '@angular/core'
import {CommonModule} from '@angular/common'
import {FormsModule} from '@angular/forms'
import {FontAwesomeModule} from '@fortawesome/angular-fontawesome'
import {LinkifyPipe} from '../../utils'
import {faComments} from '@fortawesome/free-solid-svg-icons'
import {
  VirtualScrollerModule,
  VirtualScrollerComponent
} from '@iharbeck/ngx-virtual-scroller'
import type {OnInit} from '@angular/core'
import {SocketService} from '../../network/socket.service'
import {UserService} from '../../user'

@Component({
  standalone: true,
  imports: [
    CommonModule,
    FontAwesomeModule,
    FormsModule,
    VirtualScrollerModule,
    LinkifyPipe
  ],
  selector: 'app-ui-chat-zone',
  templateUrl: './ui-chat-zone.component.html',
  styleUrls: ['./ui-chat-zone.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UiChatZoneComponent implements OnInit {
  @ViewChild(VirtualScrollerComponent)
  private virtualScroller: VirtualScrollerComponent

  public faComments = faComments
  public data = []
  public message = ''
  public chatActive = false
  public colors = {}

  public constructor(
    public socket: SocketService,
    public usrSvc: UserService
  ) {}

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
    this.socket.messages.subscribe((msg) => {
      if (['msg', 'err', 'join', 'part', 'info'].indexOf(msg.type) > -1) {
        for (const u of this.usrSvc.userList()) {
          this.colors[u.name] = '#' + u.id.substring(0, 6)
        }
        this.data.push(msg)
        this.virtualScroller.scrollInto(msg)
      }
    })
  }
}
