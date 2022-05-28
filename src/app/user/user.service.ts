import {Injectable} from '@angular/core'
import {BehaviorSubject, Subject} from 'rxjs'
import {HttpService} from './../network/http.service'
import {User} from '../user/user.model'

@Injectable({providedIn: 'root'})
export class UserService {
  public userList: User[] = []
  public listChanged: BehaviorSubject<User[]> = new BehaviorSubject([])
  public avatarChanged: Subject<any> = new Subject()
  public currentName = 'Anonymous'

  constructor(private http: HttpService) {
  }

  public currentUser() {
    return this.http.getLogged()
  }

  clearList() {
    this.userList = []
    this.listChanged.next([])
  }

  refreshList(list: any[]) {
    this.userList = this.userList.filter(u => list.map(c => c.id).indexOf(u.id) > -1)
    for (const u of list) {
      if (this.userList.map(c => c.id).indexOf(u.id) === -1) {
        this.userList.push(new User({id: u.id, name: u.name, avatar: u.avatar, world: u.world}))
      } else {
        this.userList.forEach(user => {
          if (user.id === u.id) {
            user.world = u.world
          }
        })
      }
    }
    this.listChanged.next(this.userList)
  }

  setAvatar(userId: string, avatarId: number) {
    const user = this.userList.find(u => u.id === userId)
    if (user != null && user.name !== this.currentName) {
      user.avatar = avatarId
      this.avatarChanged.next(user)
    }
  }

  setPosition(userId: string, postion: [THREE.Vector3, THREE.Vector3], state: string = 'idle', gesture: string = null) {
    const u = this.userList.find(user => user.id === userId)
    if (u == null) {
      return
    }
    if (u.x !== postion[0].x || u.y !== postion[0].y || u.z !== postion[0].z ||
        u.roll !== postion[1].x || u.yaw !== postion[1].y || u.pitch !== postion[1].z ||
        u.gesture !== gesture) {
      u.oldX = u.x
      u.oldY = u.y
      u.oldZ = u.z
      u.oldRoll = u.roll
      u.oldYaw = u.yaw
      u.oldPitch = u.pitch
      u.x = postion[0].x
      u.y = postion[0].y
      u.z = postion[0].z
      u.roll = postion[1].x
      u.yaw = postion[1].y
      u.pitch = postion[1].z
      u.completion = 0
      u.state = state
      u.gesture = gesture
    }
  }
}
