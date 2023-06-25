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
  terrain_offset?: number
  terrain_ambient?: number
  terrain_diffuse?: number
  fog?: boolean
  fog_color?: number[]
  fog_min?: number
  fog_max?: number
  water?: boolean
  water_offset?: number
  water_color?: number[]
  water_texture_top?: string
  water_texture_bottom?: string
  amblight_color?: number[]
  dirlight_color?: number[]
  light_dir?: number[]
  elev?: any

  constructor(params: World = {}) {
    this.terrain = false
    this.fog = false
    this.water = false
    this.fog_color = [0, 0, 127]
    this.fog_min = 0
    this.fog_max = 120
    this.terrain_offset = 0
    this.terrain_ambient = 0.2
    this.terrain_diffuse = 1
    this.water_offset = 0
    this.water_color = [0, 0, 255]
    this.water_texture_top = ''
    this.water_texture_bottom = ''
    this.entry = '0N 0W'
    this.sky_color = {
      top: [0, 0, 0],
      north: [0, 0, 0],
      east: [0, 0, 0],
      south: [0, 0, 0],
      west: [0, 0, 0],
      bottom: [0, 0, 0]
    }
    this.amblight_color = [255, 255, 255]
    this.dirlight_color = [255, 255, 255]
    this.light_dir = [-0.8, -0.5, -0.2]
    Object.assign(this, params)
  }
}
