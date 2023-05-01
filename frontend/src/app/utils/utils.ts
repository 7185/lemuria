import {Vector3} from 'three'

export class Utils {
  static posToStringSimple(pos: Vector3): string {
    return (
      (Math.abs(pos.z) / 10).toFixed(2).concat(pos.z >= 0 ? 'N' : 'S') +
      ' ' +
      (Math.abs(pos.x) / 10).toFixed(2).concat(pos.x >= 0 ? 'W' : 'E')
    )
  }

  /**
   * Converts position to string
   *
   * @param pos Position
   * @param yaw Yaw in degrees
   * @returns Position string with optional yaw
   */
  static posToString(pos: Vector3, yaw = 0): string {
    const ns = pos.z >= 0 ? 'N' : 'S'
    const ew = pos.x >= 0 ? 'W' : 'E'
    const s = `${(Math.abs(pos.z) / 10).toFixed(2)}${ns} ${(
      Math.abs(pos.x) / 10
    ).toFixed(2)}${ew} ${(Math.abs(pos.y) / 10).toFixed(2)}a`
    return yaw ? `${s} ${yaw}` : s
  }

  static altToString(pos: Vector3): string {
    return pos.y.toFixed(2)
  }

  static stringToPos(pos: string): Vector3 {
    const r = new Vector3()
    const [, zNum, , zHemi, xNum, , xHemi, , yNum] =
      /([+-]?([0-9]*[.])?[0-9]+)(N|S)\s([+-]?([0-9]*[.])?[0-9]+)(W|E)(\s([+-]?([0-9]*[.])?[0-9]+)a)?/i.exec(
        pos
      ) || []
    if (zNum && xNum) {
      r.z = Number.parseFloat(zNum) * (zHemi === 'N' ? 10 : -10)
      r.y = (Number.parseFloat(yNum) || 0) * 10
      r.x = Number.parseFloat(xNum) * (xHemi === 'W' ? 10 : -10)
    }
    return r
  }

  static modelName(name: string) {
    if (name.endsWith('.rwx')) {
      return name
    }
    if (name.endsWith('.zip')) {
      return name.slice(0, -4) + '.rwx'
    }
    return name + '.rwx'
  }

  static radNormalized(value: number): number {
    if (value > Math.PI) {
      value -= 2 * Math.PI
    } else if (value < -Math.PI) {
      value += 2 * Math.PI
    }
    return value
  }

  static shortestAngle(oldValue: number, newValue: number): number {
    // Work within [0, 2*PI] instead of [-Pi, Pi] for the original values
    let diff = newValue - oldValue + Math.PI

    // /!\ Careful there: the modulo ( % ) operator doesn't change anything on negative values,
    //     so even the difference itself needs to fit into [0, 2*PI]
    if (diff < 0) {
      diff += 2 * Math.PI
    }

    // The final result still needs to be expressed within [-Pi, Pi],
    // so we translate the result back into it.
    return (diff % (2 * Math.PI)) - Math.PI
  }
}
