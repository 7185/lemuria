import {KeyValuePipe} from '@angular/common'
import {toObservable} from '@angular/core/rxjs-interop'
import {MatBadge} from '@angular/material/badge'
import {MatIconButton} from '@angular/material/button'
import {MatDialog} from '@angular/material/dialog'
import {MatDivider} from '@angular/material/divider'
import {
  MatMenu,
  MatMenuContent,
  MatMenuItem,
  MatMenuTrigger
} from '@angular/material/menu'
import {MatToolbar} from '@angular/material/toolbar'
import {
  FaIconComponent,
  FaLayersComponent,
  FaLayersTextComponent
} from '@fortawesome/angular-fontawesome'
import {HttpService} from '../../network'
import {EngineService} from '../../engine/engine.service'
import {SettingsService} from '../../settings/settings.service'
import {TeleportService} from '../../engine/teleport.service'
import {WorldService} from '../../world/world.service'
import {UserService} from '../../user'
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  Renderer2,
  signal,
  untracked,
  viewChild
} from '@angular/core'
import type {ElementRef, OnInit} from '@angular/core'
import {SocketService} from '../../network/socket.service'
import type {User} from '../../user'
import {environment} from '../../../environments/environment'
import {Vector3} from 'three'
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
  imports: [
    MatBadge,
    MatIconButton,
    MatDivider,
    MatMenu,
    MatMenuContent,
    MatMenuItem,
    MatMenuTrigger,
    MatToolbar,
    KeyValuePipe,
    FaIconComponent,
    FaLayersComponent,
    FaLayersTextComponent
  ],
  selector: 'app-ui-toolbar',
  templateUrl: './ui-toolbar.component.html',
  styleUrl: './ui-toolbar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UiToolbarComponent implements OnInit {
  faArrowLeft = faArrowLeft
  faArrowRight = faArrowRight
  faBolt = faBolt
  faCheck = faCheck
  faCircleUser = faCircleUser
  faCog = faCog
  faEye = faEye
  faGlobe = faGlobe
  faHand = faHand
  faHouse = faHouse
  faKeyboard = faKeyboard
  faLocationArrow = faLocationArrow
  faMountainSun = faMountainSun
  faRightFromBracket = faRightFromBracket
  faPerson = faPerson
  faUser = faUser
  faUsers = faUsers
  faVideo = faVideo

  debug = environment.debug
  cameraType = signal(0)
  home = {world: null, position: null, isNew: true}
  teleports = signal([])
  userId = ''
  avatarId = 0
  userList: User[] = []
  visibilityList = Array.from<number>({length: 11})
    .fill(40)
    .map((n, i) => n + i * 20)
  visibility = environment.world.lod.maxDistance
  strPos = signal(Utils.posToStringSimple(new Vector3()))
  strAlt = signal(Utils.altToString(new Vector3()))
  strFps = '0 FPS 0 draws'
  strMem = '0 Geom. 0 Text.'

  protected readonly dialog = inject(MatDialog)
  protected readonly socket = inject(SocketService)
  protected readonly worldSvc = inject(WorldService)
  protected readonly teleportSvc = inject(TeleportService)
  protected readonly userSvc = inject(UserService)
  private readonly renderer = inject(Renderer2)
  private readonly engineSvc = inject(EngineService)
  private readonly http = inject(HttpService)
  private readonly settings = inject(SettingsService)
  private compass = viewChild.required<ElementRef>('compass')

  constructor() {
    effect(() => {
      untracked(this.worldSvc.worldList).forEach((w) => (w.users = 0))
      this.userSvc.userList().forEach((u) => {
        const world = untracked(this.worldSvc.worldList).find(
          (w) => u.world === w.id
        )
        if (world) {
          world.users++
        }
      })
    })

    effect(() => {
      const u = this.http.getLogged()()
      this.userId = u.id
      this.userSvc.currentName = u.name
      if (u.id != null) {
        this.http
          .worlds()
          .subscribe((w: {id: number; name: string; users: number}[]) => {
            this.worldSvc.worldList.set(w)
            const home = this.settings.get('home')
            this.home = {
              world: home?.world,
              position: home?.position,
              isNew: true
            }
            if (this.home.world || this.home.position) {
              this.teleportSvc.teleport.set(this.home)
            }
          })
      }
    })

    toObservable(this.engineSvc.compassSignal)
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
        this.strPos.set(Utils.posToStringSimple(o.pos))
        this.strAlt.set(Utils.altToString(o.pos))
        this.renderer.setStyle(
          this.compass().nativeElement,
          'transform',
          `rotate(${o.theta}deg)`
        )
      })

    if (this.debug) {
      this.engineSvc.fpsObs.pipe(throttleTime(1000)).subscribe((fps) => {
        const memInfo = this.engineSvc.getMemInfo()
        this.strFps = `${fps} FPS ${memInfo[1]} draws`
        this.strMem = `${memInfo[0].geometries} Geom. ${memInfo[0].textures} Text.`
      })
    }
  }

  changeVisibility(visibility: number) {
    this.visibility = visibility
    this.worldSvc.visibility = visibility
  }

  setAnimation(animation: string) {
    this.engineSvc.gesture = animation
  }

  changeAvatar(avatarId: number) {
    if (avatarId >= this.worldSvc.avatarList.length) {
      avatarId = 0
    }
    this.socket.sendMessage({type: 'avatar', data: avatarId})
    this.worldSvc.avatarSub.next(avatarId)
  }

  teleportWorld(world: string, entry = null) {
    this.teleportSvc.teleport.set({
      world,
      position: entry,
      isNew: true
    })
  }

  logout() {
    if (this.socket.connected) {
      this.socket.close()
    }
    this.http.logout().subscribe()
  }

  async openSettings() {
    this.dialog.open(
      (await import('../ui-settings/ui-settings.component'))
        .UiSettingsComponent,
      {hasBackdrop: true}
    )
  }

  async openControls() {
    this.dialog.open(
      (await import('../ui-controls/ui-controls.component'))
        .UiControlsComponent,
      {hasBackdrop: true}
    )
  }

  async openTeleport(type = 0) {
    if (type === 1 && !this.socket.connected) {
      return
    }

    this.dialog.open(
      (await import('../ui-teleport/ui-teleport.component'))
        .UiTeleportComponent,
      {hasBackdrop: true, data: {type}}
    )
  }

  async openWorldAttribs() {
    this.dialog.open(
      (await import('../ui-world-attribs/ui-world-attribs.component'))
        .UiWorldAttribsComponent,
      {hasBackdrop: true, minWidth: 480}
    )
  }

  toggleCamera(): void {
    this.cameraType.update((type) => (type + 1) % 3)
    this.settings.set('camera', this.cameraType())
  }

  joinUser(userId: string) {
    const user = this.userSvc.getUser(userId)
    this.engineSvc.setPlayerPos(new Vector3(user.x, user.y, user.z))
    this.engineSvc.updateBoundingBox()
  }

  compassClick(north: boolean) {
    this.engineSvc.setPlayerYaw((!north && 180) || 0)
    return false
  }

  ngOnInit(): void {
    this.worldSvc.avatarSub.subscribe((avatarId) => (this.avatarId = avatarId))
    this.settings.updated.subscribe(() => {
      const home = this.settings.get('home')
      this.home = {
        world: home?.world,
        position: home?.position,
        isNew: true
      }
      this.teleports.set(this.settings.get('teleports') || [])
      this.cameraType.set(this.settings.get('camera') || 0)
      this.engineSvc.setCamera(this.cameraType())
    })
  }
}
