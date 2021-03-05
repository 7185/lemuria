import {HttpService} from './../../network/http.service'
import {EngineService} from './../../engine/engine.service'
import {WorldService} from './../../world/world.service'
import {UserService} from './../../user/user.service'
import {Component, OnInit} from '@angular/core'
import {SocketService} from 'src/app/network/socket.service'

@Component({
  selector: 'app-ui-toolbar',
  templateUrl: './ui-toolbar.component.html',
  styleUrls: ['./ui-toolbar.component.scss']
})
export class UiToolbarComponent implements OnInit {

  public firstPerson = true
  public name = 'Anonymous'

  public constructor(public socket: SocketService, private engine: EngineService, public world: WorldService, private http: HttpService,
    public userSvc: UserService) {
  }

  public login() {
    this.http.login(this.name, 'password').subscribe(() => {
      this.userSvc.currentName = this.name
    })
  }

  public changeAvatar(avatarId: number) {
    if (avatarId > this.world.avatarList.length - 1) {
      avatarId = 0
    }
    this.socket.sendMessage({type: 'avatar', data: avatarId})
    this.world.setAvatar(this.world.avatarList[avatarId])
  }

  public connect() {
    this.socket.connect()
    this.http.world('lemuria').subscribe(w => {
      this.world.setWorld(w)
    })
  }

  public toggleCamera(): void {
    this.firstPerson = !this.firstPerson
    this.engine.toggleCamera()
  }

  public ngOnInit(): void {
    this.name = localStorage.getItem('login') || 'Anonymous'
    this.userSvc.currentName = this.name
  }

}
