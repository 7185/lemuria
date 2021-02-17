import {Component, OnInit} from '@angular/core'
import {SocketService} from '../../network/socket.service'

@Component({
  selector: 'app-ui-chat-zone',
  templateUrl: './ui-chat-zone.component.html',
  styleUrls: ['./ui-chat-zone.component.scss']
})
export class UiChatZoneComponent implements OnInit {

  public data = []

  public constructor(private socket: SocketService) {
  }

  public ngOnInit(): void {
    this.socket.messages.subscribe(msg => {
      if (msg.type === 'msg') {
        this.data.push(msg)
      }
    })
  }
}
