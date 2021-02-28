export class User {
  id?: string
  name?: string
  x? = 0
  y? = 0
  z? = 0
  oldX? = 0
  oldY? = 0
  oldZ? = 0
  constructor(params: User = {}) {
    Object.assign(this, params)
  }
}
