import {CommonModule} from '@angular/common'
import {FontAwesomeModule} from '@fortawesome/angular-fontawesome'
import {BsDropdownModule} from 'ngx-bootstrap/dropdown'
import {UiControlsComponent} from '../ui-controls/ui-controls.component'
import {UiSettingsComponent} from '../ui-settings/ui-settings.component'
import {UiTeleportComponent} from '../ui-teleport/ui-teleport.component'
import {UiWorldAttribsComponent} from '../ui-world-attribs/ui-world-attribs.component'
import {HttpService} from '../../network'
import {EngineService} from '../../engine/engine.service'
import {SettingsService} from '../../settings/settings.service'
import {TeleportService} from '../../engine/teleport.service'
import {WorldService} from '../../world/world.service'
import {UserService} from '../../user'
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  effect,
  ElementRef,
  Renderer2,
  signal,
  TemplateRef,
  ViewChild
} from '@angular/core'
import type {AfterViewInit, OnInit} from '@angular/core'
import {SocketService} from '../../network/socket.service'
import type {User} from '../../user'
import {config} from '../../app.config'
import {Vector3} from 'three'
import type {BsModalRef} from 'ngx-bootstrap/modal'
import {BsModalService} from 'ngx-bootstrap/modal'
import {distinctUntilChanged, throttleTime} from 'rxjs'
import {Utils} from '../../utils'
import {
  faArrowLeft,
  faArrowRight,
  faBolt,
  faCheck,
  faCircleUser,
  faCog,
  faEye,
  faGlobe,
  faHand,
  faHouse,
  faKeyboard,
  faLocationArrow,
  faMountainSun,
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
    UiSettingsComponent,
    UiTeleportComponent,
    UiWorldAttribsComponent
  ],
  selector: 'app-ui-toolbar',
  templateUrl: './ui-toolbar.component.html',
  styleUrls: ['./ui-toolbar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UiToolbarComponent implements OnInit, AfterViewInit {
  @ViewChild('compass', {static: true}) compass: ElementRef
  @ViewChild('settingsModal') settingsModalTpl: TemplateRef<unknown>
  @ViewChild('controlsModal') controlsModalTpl: TemplateRef<unknown>
  @ViewChild('teleportModal') teleportModalTpl: TemplateRef<unknown>
  @ViewChild('worldAttribsModal') worldAttribsModalTpl: TemplateRef<unknown>

  public faArrowLeft = faArrowLeft
  public faArrowRight = faArrowRight
  public faBolt = faBolt
  public faCheck = faCheck
  public faCircleUser = faCircleUser
  public faCog = faCog
  public faEye = faEye
  public faGlobe = faGlobe
  public faHand = faHand
  public faHouse = faHouse
  public faKeyboard = faKeyboard
  public faLocationArrow = faLocationArrow
  public faMountainSun = faMountainSun
  public faRightFromBracket = faRightFromBracket
  public faPerson = faPerson
  public faUser = faUser
  public faUsers = faUsers
  public faVideo = faVideo

  public settingsModal: BsModalRef
  public controlsModal: BsModalRef
  public teleportModal: BsModalRef
  public worldAttribsModal: BsModalRef
  public debug = config.debug
  public cameraType = 0
  public name = 'Anonymous'
  public home = {world: null, position: null, isNew: true}
  public teleports = signal([])
  public userId: string
  public avatarId = 0
  public userList: User[] = []
  public visibilityList = new Array(11).fill(40).map((n, i) => n + i * 20)
  public visibility = config.world.lod.maxDistance
  public strPos: string
  public strAlt: string
  public strFps = '0 FPS'
  public strMem = '0 Geom. 0 Text.'
  public teleportType = 0

  public constructor(
    private renderer: Renderer2,
    private cdRef: ChangeDetectorRef,
    private modalSvc: BsModalService,
    public socket: SocketService,
    private engineSvc: EngineService,
    public worldSvc: WorldService,
    private http: HttpService,
    private userSvc: UserService,
    public teleportSvc: TeleportService,
    private settings: SettingsService
  ) {
    effect(() => {
      this.userList = this.userSvc.userListSignal()
      this.worldSvc.worldList.forEach((w) => (w.users = 0))
      for (const u of this.userList) {
        for (const w of this.worldSvc.worldList) {
          if (u.world === w.id) {
            w.users++
          }
        }
      }
      this.cdRef.detectChanges()
    })
  }

  public changeVisibility(visibility: number) {
    this.visibility = visibility
    this.worldSvc.setVisibility(visibility)
  }

  public setAnimation(animation: string) {
    this.engineSvc.setGesture(animation)
  }

  public changeAvatar(avatarId: number) {
    if (avatarId >= this.worldSvc.avatarList.length) {
      avatarId = 0
    }
    this.socket.sendMessage({type: 'avatar', data: avatarId})
    this.worldSvc.avatarSub.next(avatarId)
  }

  public teleportWorld(world: string, entry = null) {
    this.teleportSvc.teleport.set({
      world,
      position: entry,
      isNew: true
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

  public openTeleport(type = 0) {
    if (type === 1 && !this.socket.connected) {
      return
    }
    this.teleportType = type
    this.teleportModal = this.modalSvc.show(this.teleportModalTpl, {
      backdrop: false
    })
  }

  public closeTeleport() {
    this.teleportModal.hide()
  }

  public openWorldAttribs() {
    this.worldAttribsModal = this.modalSvc.show(this.worldAttribsModalTpl, {
      backdrop: false,
      class: 'modal-lg'
    })
  }

  public closeWorldAttribs() {
    this.worldAttribsModal.hide()
  }

  public toggleCamera(): void {
    this.cameraType = (this.cameraType + 1) % 3
    this.engineSvc.toggleCamera()
  }

  public join(userId: string) {
    const user = this.userSvc.userList.find((v) => v.id === userId)
    this.engineSvc.setPlayerPos(new Vector3(user.x, user.y, user.z))
  }

  public compassClick(north: boolean) {
    this.engineSvc.setPlayerYaw(!north && 180)
    return false
  }

  public ngOnInit(): void {
    this.worldSvc.avatarSub.subscribe((avatarId) => (this.avatarId = avatarId))
    this.http.getLogged().subscribe((u: any) => {
      this.userId = u.id
      this.name = u.name
      this.userSvc.currentName = u.name
      if (u.id != null) {
        this.http.worlds().subscribe((w: any) => {
          this.worldSvc.worldList = w
          const home = this.settings.get('home')
          this.home = {
            world: home?.world,
            position: home?.position,
            isNew: true
          }
          if (this.home.world || this.home.position) {
            this.teleportSvc.teleport.set(this.home)
          }
          this.cdRef.detectChanges()
        })
      }
      this.cdRef.detectChanges()
    })
    this.settings.updated.subscribe(() => {
      const home = this.settings.get('home')
      this.home = {
        world: home?.world,
        position: home?.position,
        isNew: true
      }
      this.teleports.set(this.settings.get('teleports') || [])
      this.cdRef.detectChanges()
    })
  }

  public ngAfterViewInit(): void {
    this.engineSvc.compassSub
      .pipe(
        throttleTime(100),
        distinctUntilChanged(
          (
            prev: {pos: Vector3; theta: number},
            curr: {pos: Vector3; theta: number}
          ) =>
            prev.pos.x === curr.pos.x &&
            prev.pos.y === curr.pos.y &&
            prev.pos.z === curr.pos.z &&
            prev.theta === curr.theta
        )
      )
      .subscribe((o: {pos: Vector3; theta: number}) => {
        this.strPos = Utils.posToStringSimple(o.pos)
        this.strAlt = Utils.altToString(o.pos)
        this.renderer.setStyle(
          this.compass.nativeElement,
          'transform',
          `rotate(${o.theta}deg)`
        )
        this.cdRef.detectChanges()
      })

    if (this.debug) {
      this.engineSvc.fpsSub.pipe(throttleTime(1000)).subscribe((fps) => {
        const memInfo = this.engineSvc.getMemInfo()
        this.strFps = `${fps} FPS`
        this.strMem = `${memInfo.geometries} Geom. ${memInfo.textures} Text.`
      })
    }
  }
}
