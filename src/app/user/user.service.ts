import {Injectable} from '@angular/core'
import {Subject} from 'rxjs'
import {User} from 'src/app/user/user.model'

@Injectable({providedIn: 'root'})
export class UserService {
  public userList: User[] = []
  public listChanged: Subject<any> = new Subject()
  public currentName = 'Anonymous'

  constructor() {
  }

  clearList() {
    this.userList = []
    this.listChanged.next()
  }

  refreshList(list: any[]) {
    this.userList = this.userList.filter(u => list.map(c => c.id).indexOf(u.id) > -1)
    for (const u of list) {
      if (this.userList.map(c => c.id).indexOf(u.id) === -1) {
        this.userList.push(new User({id: u.id, name: u.name}))
      }
    }
    this.listChanged.next()
  }

  setPosition(userId: string, postion: [THREE.Vector3, THREE.Vector3]) {
    for (const u of this.userList) {
      if (u.id === userId) {
        if (u.x !== postion[0].x || u.y !== postion[0].y || u.z !== postion[0].z ||
            u.roll !== postion[1].x || u.yaw !== postion[1].y || u.pitch !== postion[1].z) {
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
        }
      }
    }
  }
}
