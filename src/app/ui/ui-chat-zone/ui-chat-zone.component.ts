import {Component, OnInit, ViewChild} from '@angular/core'
import {VirtualScrollerComponent} from 'ngx-virtual-scroller'
import {SocketService} from '../../network/socket.service'

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

  public constructor(public socket: SocketService) {
  }

  public send(): void {
    if (this.message.length) {
      this.socket.sendMessage({type: 'msg', data: this.message})
      this.message = ''
    }
  }

  public ngOnInit(): void {
    this.socket.messages.subscribe(msg => {
      if (msg.type != 'list') {
        this.data.push(msg)
        this.virtualScroller.scrollInto(msg)
      }
    })
  }
}
