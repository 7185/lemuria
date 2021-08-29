import {HttpService} from './../../network/http.service'
import {EngineService} from './../../engine/engine.service'
import {WorldService} from './../../world/world.service'
import {UserService} from './../../user/user.service'
import {AfterViewInit, Component, ElementRef, OnInit, Renderer2, ViewChild} from '@angular/core'
import {SocketService} from '../../network/socket.service'
import {User} from '../../user/user.model'
import {config} from '../../app.config'
import {Vector3} from 'three'

@Component({
  selector: 'app-ui-toolbar',
  templateUrl: './ui-toolbar.component.html',
  styleUrls: ['./ui-toolbar.component.scss']
})
export class UiToolbarComponent implements OnInit, AfterViewInit {

  @ViewChild('compass', {static: true}) compass: ElementRef

  public firstPerson = true
  public name = 'Anonymous'
  public userId: string
  public avatarId = 0
  public list: User[] = []
  public worldList = []
  public visibilityList = new Array(11).fill(40).map((n, i) => n + i * 20)
  public visibility = config.world.lod.maxDistance

  public constructor(
    private renderer: Renderer2,
    public socket: SocketService,
    private engine: EngineService,
    public world: WorldService,
    private http: HttpService,
    private userSvc: UserService) {
  }

  public changeVisibility(visibility: number) {
    this.visibility = visibility
    this.world.setVisibility(visibility)
  }

  public changeAvatar(avatarId: number) {
    if (avatarId >= this.world.avatarList.length) {
      avatarId = 0
    }
    this.avatarId = avatarId
    this.socket.sendMessage({type: 'avatar', data: avatarId})
    this.world.setAvatar(this.world.avatarList[avatarId].geometry)
  }

  public connect(worldId = 1) {
    this.socket.connect()

    this.http.world(worldId).subscribe((w: any) => {
      this.socket.messages.next({type: 'info', data: w.welcome})
      this.world.setWorld(w)
    })
  }

  public logout() {
    if (this.socket.connected) {
      this.socket.close()
    }
    this.http.logout().subscribe()
  }

  public toggleCamera(): void {
    this.firstPerson = !this.firstPerson
    this.engine.toggleCamera()
  }

  public enableCollision(): void {
    this.engine.refreshOctree()
  }

  public join(userId: string) {
    const user = this.userSvc.userList.find(v => v.id === userId)
    this.engine.teleport(new Vector3(user.x, user.y, user.z))
  }

  public ngOnInit(): void {
    this.http.getLogged().subscribe((u: any) => {
      this.userId = u.id
      this.name = u.name
      this.userSvc.currentName = u.name
      this.http.worlds().subscribe((w: any) => {
        this.worldList = w
      })
    })
    this.userSvc.listChanged.subscribe((l) => this.list = l)
  }

  public ngAfterViewInit(): void {
    this.engine.compassSub.subscribe((o: number) => {
      this.renderer.setStyle(this.compass.nativeElement, 'transform', `rotate(${o}deg)`)
    })
  }
}
