import {HttpService} from './../../network/http.service'
import {EngineService} from './../../engine/engine.service'
import {WorldService} from './../../world/world.service'
import {UserService} from './../../user/user.service'
import {ChangeDetectorRef, Component, ElementRef, Renderer2, ViewChild} from '@angular/core'
import type {AfterViewInit, OnInit} from '@angular/core'
import {SocketService} from '../../network/socket.service'
import type {User} from '../../user/user.model'
import {config} from '../../app.config'
import {Vector3} from 'three'
import {distinctUntilChanged, throttleTime} from 'rxjs'
import Utils from '../../utils/utils'

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
  public strPos: string
  public strAlt: string

  public constructor(
    private renderer: Renderer2,
    private cdRef: ChangeDetectorRef,
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
    this.socket.sendMessage({type: 'avatar', data: avatarId})
    this.world.avatarSub.next(avatarId)
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
    this.world.avatarSub.subscribe((avatarId) => this.avatarId = avatarId)
  }

  public ngAfterViewInit(): void {
    this.engine.compassSub.pipe(
      throttleTime(100),
      distinctUntilChanged((prev: any, curr: any) =>
        prev.pos.x === curr.pos.x &&
        prev.pos.y === curr.pos.y &&
        prev.pos.z === curr.pos.z &&
        prev.theta === curr.theta
      )
    ).subscribe((o: any) => {
      this.strPos = Utils.posToString(o.pos)
      this.strAlt = Utils.altToString(o.pos)
      this.renderer.setStyle(this.compass.nativeElement, 'transform', `rotate(${o.theta}deg)`)
      this.cdRef.detectChanges()
    })
  }
}
