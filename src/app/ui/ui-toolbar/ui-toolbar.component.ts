import {HttpService} from './../../network/http.service'
import {EngineService} from './../../engine/engine.service'
import {Component, OnInit} from '@angular/core'
import {SocketService} from 'src/app/network/socket.service'

@Component({
  selector: 'app-ui-toolbar',
  templateUrl: './ui-toolbar.component.html',
  styleUrls: ['./ui-toolbar.component.scss']
})
export class UiToolbarComponent implements OnInit {

  public message = ''
  public firstPerson = true
  public name = 'Anonymous'
  public userList = []

  public constructor(public socket: SocketService, private engine: EngineService, private http: HttpService) {
  }

  public send(): void {
    if (this.message.length) {
      this.socket.sendMessage({type: 'msg', user: this.name, data: this.message})
      this.message = ''
    }
  }

  public login() {
    this.http.login(this.name, 'password').subscribe()
  }

  public enter() {
    this.http.world('lemuria').subscribe(w => {
      this.engine.setWorld(w)
    })
  }

  public toggleCamera(): void {
    this.firstPerson = !this.firstPerson
    this.engine.toggleCamera()
  }

  public ngOnInit(): void {
    this.socket.messages.subscribe(msg => {
      if (msg.type === 'list') {
        this.userList = msg.data
      }
    })
  }

}
