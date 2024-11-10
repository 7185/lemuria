import {
  ChangeDetectionStrategy,
  Component,
  inject,
  viewChild
} from '@angular/core'
import {NgStyle} from '@angular/common'
import {FormsModule} from '@angular/forms'
import {MatIconButton} from '@angular/material/button'
import {MatInput, MatLabel} from '@angular/material/input'
import {MatFormField, MatPrefix} from '@angular/material/form-field'
import {FaIconComponent} from '@fortawesome/angular-fontawesome'
import {LinkifyPipe} from '../../utils'
import {faComments} from '@fortawesome/free-solid-svg-icons'
import {
  VirtualScrollerComponent,
  VirtualScrollerModule
} from '@iharbeck/ngx-virtual-scroller'
import type {OnInit} from '@angular/core'
import {SocketService} from '../../network/socket.service'
import {UserService} from '../../user'

@Component({
  imports: [
    MatIconButton,
    MatInput,
    MatLabel,
    MatFormField,
    MatPrefix,
    FaIconComponent,
    FormsModule,
    NgStyle,
    VirtualScrollerModule,
    LinkifyPipe
  ],
  host: {
    '[class.active]': 'chatActive'
  },
  selector: 'app-ui-chat-zone',
  templateUrl: './ui-chat-zone.component.html',
  styleUrl: './ui-chat-zone.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UiChatZoneComponent implements OnInit {
  private virtualScroller = viewChild.required<VirtualScrollerComponent>(
    VirtualScrollerComponent
  )

  protected readonly socket = inject(SocketService)
  protected readonly userSvc = inject(UserService)
  faComments = faComments
  data = []
  message = ''
  chatActive = false
  protected colors = {}

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
      if (['msg', 'err', 'join', 'part', 'info'].includes(msg.type)) {
        for (const u of this.userSvc.userList()) {
          this.colors[u.name] = '#' + u.id.substring(0, 6)
        }
        this.data.push(msg)
        this.virtualScroller().scrollInto(msg)
      }
    })
  }
}
