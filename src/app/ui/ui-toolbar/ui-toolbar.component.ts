import {HttpService} from './../../network/http.service'
import {EngineService} from './../../engine/engine.service'
import {WorldService} from './../../world/world.service'
import {UserService} from './../../user/user.service'
import {AfterViewInit, Component, ElementRef, OnInit, Renderer2, ViewChild} from '@angular/core'
import {SocketService} from '../../network/socket.service'
import {User} from '../../user/user.model'

@Component({
  selector: 'app-ui-toolbar',
  templateUrl: './ui-toolbar.component.html',
  styleUrls: ['./ui-toolbar.component.scss']
})
export class UiToolbarComponent implements OnInit, AfterViewInit {

  @ViewChild('compass', {static: true}) compass: ElementRef

  public firstPerson = true
  public name = 'Anonymous'
  public list: User[] = []

  public constructor(
    private renderer: Renderer2,
    public socket: SocketService,
    private engine: EngineService,
    public world: WorldService,
    private http: HttpService,
    private userSvc: UserService) {
  }

  public changeAvatar(avatarId: number) {
    if (avatarId >= this.world.avatarList.length) {
      avatarId = 0
    }
    this.socket.sendMessage({type: 'avatar', data: avatarId})
    this.world.setAvatar(this.world.avatarList[avatarId])
  }

  public connect() {
    this.socket.connect()
    this.http.world('lemuria').subscribe((w: any) => {
      this.world.setWorld(w)
      this.socket.messages.next({type: 'info', data: w.welcome})
    })
  }

  public logout() {
    this.http.logout().subscribe()
  }

  public toggleCamera(): void {
    this.firstPerson = !this.firstPerson
    this.engine.toggleCamera()
  }

  public ngOnInit(): void {
    this.http.getLogged().subscribe((u: any) => {
      this.name = u.name
      this.userSvc.currentName = u.name
    })
    this.userSvc.listChanged.subscribe((l) => this.list = l)
  }

  public ngAfterViewInit(): void {
    this.engine.compass.subscribe((o: number) => {
      this.renderer.setStyle(this.compass.nativeElement, 'transform', `rotate(${o}deg)`)
    })
  }
}
