import {
  ChangeDetectionStrategy,
  Component,
  inject,
  viewChild
} from '@angular/core'
import {NgStyle} from '@angular/common'
import {FormsModule} from '@angular/forms'
import {MatButtonModule} from '@angular/material/button'
import {MatInputModule} from '@angular/material/input'
import {MatFormFieldModule} from '@angular/material/form-field'
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
    MatButtonModule,
    MatInputModule,
    MatFormFieldModule,
    FontAwesomeModule,
    FormsModule,
    NgStyle,
    VirtualScrollerModule,
    LinkifyPipe
  ],
  selector: 'app-ui-chat-zone',
  templateUrl: './ui-chat-zone.component.html',
  styleUrl: './ui-chat-zone.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UiChatZoneComponent implements OnInit {
  private virtualScroller = viewChild.required<VirtualScrollerComponent>(
    VirtualScrollerComponent
  )

  socket = inject(SocketService)
  usrSvc = inject(UserService)
  faComments = faComments
  data = []
  message = ''
  chatActive = false
  colors = {}

  activeChat() {
    this.chatActive = !this.chatActive
  }

  send(): void {
    if (this.message.length) {
      this.socket.sendMessage({type: 'msg', data: this.message})
      this.message = ''
    }
  }

  ngOnInit(): void {
    this.socket.messages.subscribe((msg) => {
      if (['msg', 'err', 'join', 'part', 'info'].indexOf(msg.type) > -1) {
        for (const u of this.usrSvc.userList()) {
          this.colors[u.name] = '#' + u.id.substring(0, 6)
        }
        this.data.push(msg)
        this.virtualScroller().scrollInto(msg)
      }
    })
  }
}
