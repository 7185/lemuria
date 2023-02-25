export class World {
  id?: number
  name?: string
  welcome?: string
  path?: string
  skybox?: string
  sky_color?: any
  entry?: string = '0N 0W'
  objects?: any
  terrain?: boolean
  elev?: any

  constructor(params: World = {}) {
    this.terrain = false
    this.entry = '0N 0W'
    this.sky_color = {
      top: [0, 0, 0],
      north: [0, 0, 0],
      east: [0, 0, 0],
      south: [0, 0, 0],
      west: [0, 0, 0],
      bottom: [0, 0, 0]
    }
    Object.assign(this, params)
  }
}
