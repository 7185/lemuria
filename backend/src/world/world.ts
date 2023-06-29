export class World {
  id?: number
  name?: string
  welcome?: string
  path?: string
  skybox?: string
  sky?: {
    skybox: string
    top_color: number[]
    north_color: number[]
    east_color: number[]
    south_color: number[]
    west_color: number[]
    bottom_color: number[]
  }
  entry?: string = '0N 0W'
  objects?: any
  light?: {
    fog: {color: number[]; enabled: boolean; min: number; max: number}
    dir_color: number[]
    amb_color: number[]
    dir: {x: number; y: number; z: number}
  }
  terrain?: {enabled: boolean; ambient: number; diffuse: number; offset: number}
  water?: {
    texture_top: string
    opacity: number
    color: number[]
    offset: number
    texture_bottom: string
    enabled: boolean
    under_view: number
  }
  water_offset?: number
  water_color?: number[]
  water_texture_top?: string
  water_texture_bottom?: string
  elev?: any

  constructor(params: World = {}) {
    this.entry = '0N 0W'
    this.light = {
      fog: {
        color: [0, 0, 127],
        enabled: false,
        min: 0,
        max: 120
      },
      dir_color: [255, 255, 255],
      amb_color: [255, 255, 255],
      dir: {x: -0.8, y: -0.5, z: -0.2}
    }
    this.sky = {
      skybox: '',
      top_color: [0, 0, 0],
      north_color: [0, 0, 0],
      east_color: [0, 0, 0],
      south_color: [0, 0, 0],
      west_color: [0, 0, 0],
      bottom_color: [0, 0, 0]
    }
    this.terrain = {
      enabled: false,
      ambient: 0.2,
      diffuse: 1,
      offset: 0
    }
    this.water = {
      texture_top: '',
      opacity: 180,
      color: [0, 0, 255],
      offset: -1,
      texture_bottom: '',
      enabled: false,
      under_view: 120
    }
    Object.assign(this, params)
  }
}
