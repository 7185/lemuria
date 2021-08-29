import {Vector3} from 'three'

export default class Utils {
  static posToString(pos: Vector3): string {
    return (Math.abs(pos.z) / 10).toFixed(2).concat(pos.z >= 0 ? 'N' : 'S') + ' ' +
      (Math.abs(pos.x) / 10).toFixed(2).concat(pos.x >= 0 ? 'W' : 'E')
  }

  static stringToPos(pos: string): Vector3 {
    const r = new Vector3()
    const m = /([+-]?([0-9]*[.])?[0-9]+)(N|S)\s([+-]?([0-9]*[.])?[0-9]+)(W|E).*/i.exec(pos)
    if (m !== null) {
      r.z = Number.parseFloat(m[1]) * (m[3] === 'N' ? 10 : -10)
      r.x = Number.parseFloat(m[4]) * (m[6] === 'W' ? 10 : -10)
    }
    return r
  }
}
