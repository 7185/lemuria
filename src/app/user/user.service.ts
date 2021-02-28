import {Injectable} from '@angular/core'
import {Subject} from 'rxjs'
import {User} from 'src/app/user/user.model'

@Injectable({providedIn: 'root'})
export class UserService {
  public userList: User[] = []
  public userMoved: Subject<any> = new Subject()
  public currentName = 'Anonymous'

  constructor() {
  }

  setPosition(userId: string, postion: THREE.Vector3) {
    for (const u of this.userList) {
      if (u.id === userId) {
        if (u.x !== postion.x || u.y !== postion.y || u.z !== postion.z) {
          u.oldX = u.x
          u.oldY = u.y
          u.oldZ = u.z
          u.x = postion.x
          u.y = postion.y
          u.z = postion.z
          this.userMoved.next(u)
        }
      }
    }
  }
}
