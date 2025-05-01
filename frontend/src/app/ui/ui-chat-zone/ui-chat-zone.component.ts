import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  viewChild
} from '@angular/core'
import {NgStyle} from '@angular/common'
import {FormsModule} from '@angular/forms'
import {MatIconButton} from '@angular/material/button'
import {MatInput, MatLabel} from '@angular/material/input'
import {MatFormField, MatPrefix} from '@angular/material/form-field'
import {FaIconComponent} from '@fortawesome/angular-fontawesome'
import {LinkifyPipe} from '../../utils/linkify.pipe'
import {faComments} from '@fortawesome/free-solid-svg-icons'
import {
  VirtualScrollerComponent,
  VirtualScrollerModule
} from '@iharbeck/ngx-virtual-scroller'
import type {Message} from '../../network'
import {SocketService} from '../../network'
import {UserService} from '../../user'
import {provideTranslocoScope, TranslocoDirective} from '@jsverse/transloco'
import {SettingsService} from '../../settings/settings.service'

@Component({
  imports: [
    TranslocoDirective,
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
  providers: [
    provideTranslocoScope({scope: 'ui/ui-chat-zone', alias: 'chat-zone'})
  ],
  host: {
    '[class.active]': 'chatActive()',
    '[class.vertical]': 'verticalChat()',
    '[class.horizontal]': '!verticalChat()'
  },
  selector: 'app-ui-chat-zone',
  templateUrl: './ui-chat-zone.component.html',
  styleUrl: './ui-chat-zone.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UiChatZoneComponent {
  private virtualScroller = viewChild<VirtualScrollerComponent>(
    VirtualScrollerComponent
  )

  protected readonly socket = inject(SocketService)
  protected readonly userSvc = inject(UserService)
  private readonly settings = inject(SettingsService)
  protected readonly icon = {faComments}
  protected messages: Message[] = []
  protected message = ''
  protected chatActive = signal(false)
  protected verticalChat = signal(true)
  protected names = {}
  protected colors = {}

  constructor() {
    this.socket.messages.subscribe((msg) => {
      if (!['msg', 'err', 'join', 'part', 'info'].includes(msg.type)) {
        return
      }
      for (const u of this.userSvc.userList()) {
        this.colors[u.id] = '#' + u.id.substring(0, 6)
        this.names[u.id] = u.name
      }
      this.messages.push(msg)
      if (this.virtualScroller() == null) return
      this.virtualScroller().scrollInto(msg)
    })
    this.settings.updated.subscribe(() => {
      this.verticalChat.set(this.settings.get('verticalChat') ?? true)
    })
  }

  activeChat() {
    this.chatActive.update((value) => !value)
  }

  send() {
    if (!this.message.length) return
    this.socket.sendMessage({type: 'msg', data: this.message})
    this.message = ''
  }
}
