import {Vector3} from 'three'

export default class Utils {
  static posToString(pos: Vector3): string {
    return (Math.abs(pos.z) / 10).toFixed(2).concat(pos.z >= 0 ? 'N' : 'S') + ' ' +
      (Math.abs(pos.x) / 10).toFixed(2).concat(pos.x >= 0 ? 'W' : 'E')
  }

  static altToString(pos: Vector3): string {
    return pos.y.toFixed(2)
  }

  static stringToPos(pos: string): Vector3 {
    const r = new Vector3()
    const [, zNum, , zHemi, xNum, , xHemi] = /([+-]?([0-9]*[.])?[0-9]+)(N|S)\s([+-]?([0-9]*[.])?[0-9]+)(W|E).*/i.exec(pos) || []
    if (zNum && xNum) {
      r.z = Number.parseFloat(zNum) * (zHemi === 'N' ? 10 : -10)
      r.x = Number.parseFloat(xNum) * (xHemi === 'W' ? 10 : -10)
    }
    return r
  }

  static modelName(name: string) {
    if (name.endsWith('.rwx')) { return name }
    if (name.endsWith('.zip')) { return name.slice(0, -4) + '.rwx' }
    return name + '.rwx'
  }
}
