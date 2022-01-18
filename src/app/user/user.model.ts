export class User {
  id?: string
  name?: string
  x? = 0
  y? = 0
  z? = 0
  roll? = 0
  yaw? = 0
  pitch? = 0
  oldX? = 0
  oldY? = 0
  oldZ? = 0
  oldRoll? = 0
  oldYaw? = 0
  oldPitch? = 0
  completion? = 1
  avatar? = 0
  world? = 0
  constructor(params: User = {}) {
    Object.assign(this, params)
  }
}
