import {CommonModule} from '@angular/common'
import {FontAwesomeModule} from '@fortawesome/angular-fontawesome'
import {BsDropdownModule} from 'ngx-bootstrap/dropdown'
import {UiControlsComponent} from '../ui-controls/ui-controls.component'
import {UiSettingsComponent} from './../ui-settings/ui-settings.component'
import {HttpService} from '../../network/http.service'
import {EngineService} from '../../engine/engine.service'
import {WorldService} from '../../world/world.service'
import {UserService} from '../../user/user.service'
import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  Renderer2,
  TemplateRef,
  ViewChild
} from '@angular/core'
import type {AfterViewInit, OnInit} from '@angular/core'
import {SocketService} from '../../network/socket.service'
import type {User} from '../../user/user.model'
import {config} from '../../app.config'
import {Vector3} from 'three'
import type {BsModalRef} from 'ngx-bootstrap/modal'
import {BsModalService} from 'ngx-bootstrap/modal'
import {distinctUntilChanged, throttleTime} from 'rxjs'
import Utils from '../../utils/utils'
import {
  faBolt,
  faCheck,
  faCog,
  faEye,
  faGlobe,
  faKeyboard,
  faLocationArrow,
  faPerson,
  faRightFromBracket,
  faUser,
  faUsers,
  faVideo
} from '@fortawesome/free-solid-svg-icons'

@Component({
  standalone: true,
  imports: [
    CommonModule,
    BsDropdownModule,
    FontAwesomeModule,
    UiControlsComponent,
    UiSettingsComponent
  ],
  selector: 'app-ui-toolbar',
  templateUrl: './ui-toolbar.component.html',
  styleUrls: ['./ui-toolbar.component.scss']
})
export class UiToolbarComponent implements OnInit, AfterViewInit {
  @ViewChild('compass', {static: true}) compass: ElementRef
  @ViewChild('settingsModal') settingsModalTpl: TemplateRef<any>
  @ViewChild('controlsModal') controlsModalTpl: TemplateRef<any>

  public faBolt = faBolt
  public faCheck = faCheck
  public faCog = faCog
  public faEye = faEye
  public faGlobe = faGlobe
  public faKeyboard = faKeyboard
  public faLocationArrow = faLocationArrow
  public faRightFromBracket = faRightFromBracket
  public faPerson = faPerson
  public faUser = faUser
  public faUsers = faUsers
  public faVideo = faVideo

  public settingsModal: BsModalRef
  public controlsModal: BsModalRef
  public debug = config.debug
  public firstPerson = true
  public name = 'Anonymous'
  public userId: string
  public avatarId = 0
  public animations = new Map()
  public userList: User[] = []
  public worldList = []
  public visibilityList = new Array(11).fill(40).map((n, i) => n + i * 20)
  public visibility = config.world.lod.maxDistance
  public strPos: string
  public strAlt: string
  public strFps = '0 FPS'
  public strMem = '0 Geom. 0 Text.'

  public constructor(
    private renderer: Renderer2,
    private cdRef: ChangeDetectorRef,
    private modalSvc: BsModalService,
    public socket: SocketService,
    private engine: EngineService,
    public world: WorldService,
    private http: HttpService,
    private userSvc: UserService
  ) {}

  public changeVisibility(visibility: number) {
    this.visibility = visibility
    this.world.setVisibility(visibility)
  }

  public setAnimation(animation: string) {
    this.engine.setGesture(animation)
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

  public openSettings() {
    this.settingsModal = this.modalSvc.show(this.settingsModalTpl, {
      backdrop: false
    })
  }

  public closeSettings() {
    this.settingsModal.hide()
  }

  public openControls() {
    this.controlsModal = this.modalSvc.show(this.controlsModalTpl, {
      backdrop: false
    })
  }

  public closeControls() {
    this.controlsModal.hide()
  }

  public toggleCamera(): void {
    this.firstPerson = !this.firstPerson
    this.engine.toggleCamera()
  }

  public join(userId: string) {
    const user = this.userSvc.userList.find((v) => v.id === userId)
    this.engine.teleport(new Vector3(user.x, user.y, user.z))
  }

  public compassClick(north: boolean) {
    this.engine.teleport(null, !north && 180)
    return false
  }

  public ngOnInit(): void {
    this.userSvc.listChanged.subscribe((l) => {
      this.userList = l
      this.worldList.forEach((w) => (w.users = 0))
      for (const u of this.userList) {
        for (const w of this.worldList) {
          if (u.world === w.id) {
            w.users++
          }
        }
      }
    })
    this.world.avatarSub.subscribe((avatarId) => (this.avatarId = avatarId))
    this.world.animationMapSub.subscribe(
      (animations) => (this.animations = animations)
    )
    this.http.getLogged().subscribe((u: any) => {
      this.userId = u.id
      this.name = u.name
      this.userSvc.currentName = u.name
      if (u.id != null) {
        this.http.worlds().subscribe((w: any) => {
          this.worldList = w
        })
      }
    })
  }

  public ngAfterViewInit(): void {
    this.engine.compassSub
      .pipe(
        throttleTime(100),
        distinctUntilChanged(
          (prev: any, curr: any) =>
            prev.pos.x === curr.pos.x &&
            prev.pos.y === curr.pos.y &&
            prev.pos.z === curr.pos.z &&
            prev.theta === curr.theta
        )
      )
      .subscribe((o: any) => {
        this.strPos = Utils.posToString(o.pos)
        this.strAlt = Utils.altToString(o.pos)
        this.renderer.setStyle(
          this.compass.nativeElement,
          'transform',
          `rotate(${o.theta}deg)`
        )
        this.cdRef.detectChanges()
      })

    if (this.debug) {
      this.engine.fpsSub.pipe(throttleTime(1000)).subscribe((fps) => {
        const memInfo = this.engine.getMemInfo()
        this.strFps = `${fps} FPS`
        this.strMem = `${memInfo.geometries} Geom. ${memInfo.textures} Text.`
      })
    }
  }
}
