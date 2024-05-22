import {KeyValuePipe} from '@angular/common'
import {MatBadgeModule} from '@angular/material/badge'
import {MatButtonModule} from '@angular/material/button'
import {MatDialog, MatDialogModule} from '@angular/material/dialog'
import {MatDividerModule} from '@angular/material/divider'
import {MatMenuModule} from '@angular/material/menu'
import {MatToolbarModule} from '@angular/material/toolbar'
import {FontAwesomeModule} from '@fortawesome/angular-fontawesome'
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
  inject,
  Renderer2,
  signal,
  viewChild
} from '@angular/core'
import type {AfterViewInit, ElementRef, OnInit} from '@angular/core'
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
  standalone: true,
  imports: [
    MatBadgeModule,
    MatButtonModule,
    MatDialogModule,
    MatDividerModule,
    MatMenuModule,
    MatToolbarModule,
    KeyValuePipe,
    FontAwesomeModule
  ],
  selector: 'app-ui-toolbar',
  templateUrl: './ui-toolbar.component.html',
  styleUrl: './ui-toolbar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UiToolbarComponent implements OnInit, AfterViewInit {
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
  cameraType = 0
  name = 'Anonymous'
  home = {world: null, position: null, isNew: true}
  teleports = signal([])
  userId: string
  avatarId = 0
  userList: User[] = []
  visibilityList = Array.from<number>({length: 11})
    .fill(40)
    .map((n, i) => n + i * 20)
  visibility = environment.world.lod.maxDistance
  strPos: string
  strAlt: string
  strFps = '0 FPS 0 draws'
  strMem = '0 Geom. 0 Text.'

  readonly dialog = inject(MatDialog)
  readonly socket = inject(SocketService)
  readonly worldSvc = inject(WorldService)
  readonly teleportSvc = inject(TeleportService)
  private readonly renderer = inject(Renderer2)
  private readonly cdRef = inject(ChangeDetectorRef)
  private readonly engineSvc = inject(EngineService)
  private readonly http = inject(HttpService)
  private readonly userSvc = inject(UserService)
  private readonly settings = inject(SettingsService)
  private compass = viewChild.required<ElementRef>('compass')

  constructor() {
    effect(() => {
      this.userList = this.userSvc.userList()
      this.worldSvc.worldList.forEach((w) => (w.users = 0))
      this.userList.forEach((u) => {
        const world = this.worldSvc.worldList.find((w) => u.world === w.id)
        if (world) {
          world.users++
        }
      })
      this.cdRef.detectChanges()
    })
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
    this.cameraType = (this.cameraType + 1) % 3
    this.settings.set('camera', this.cameraType)
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
    this.http.getLogged().subscribe((u: User) => {
      this.userId = u.id
      this.name = u.name
      this.userSvc.currentName = u.name
      if (u.id != null) {
        this.http
          .worlds()
          .subscribe((w: {id: number; name: string; data: unknown}[]) => {
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
      this.cameraType = this.settings.get('camera') || 0
      this.engineSvc.setCamera(this.cameraType)
      this.cdRef.detectChanges()
    })
  }

  ngAfterViewInit(): void {
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
          this.compass().nativeElement,
          'transform',
          `rotate(${o.theta}deg)`
        )
        this.cdRef.detectChanges()
      })

    if (this.debug) {
      this.engineSvc.fpsSub.pipe(throttleTime(1000)).subscribe((fps) => {
        const memInfo = this.engineSvc.getMemInfo()
        this.strFps = `${fps} FPS ${memInfo[1]} draws`
        this.strMem = `${memInfo[0].geometries} Geom. ${memInfo[0].textures} Text.`
      })
    }
  }
}
