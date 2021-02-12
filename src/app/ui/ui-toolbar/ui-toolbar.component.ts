import {Component, OnInit} from '@angular/core'
import {SocketService} from 'src/app/network/socket.service'

@Component({
  selector: 'app-ui-toolbar',
  templateUrl: './ui-toolbar.component.html',
  styleUrls: ['./ui-toolbar.component.scss']
})
export class UiToolbarComponent implements OnInit {

  public message = ''
  public name = 'Anonymous'

  public constructor(private socket: SocketService) {
  }

  public send() {
    this.socket.sendMessage({type: 'msg', user: this.name, data: this.message})
    this.message = ''
  }

  public ngOnInit(): void {
  }

}
