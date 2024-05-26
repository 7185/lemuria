import {Mesh, Vector3} from 'three'
import type {Object3D} from 'three'

export class Utils {
  static posToStringSimple(pos: Vector3): string {
    return `${(Math.abs(pos.z) / 10).toFixed(2)}${pos.z >= 0 ? 'N' : 'S'} ${(
      Math.abs(pos.x) / 10
    ).toFixed(2)}${pos.x >= 0 ? 'W' : 'E'}`
  }

  /**
   * Converts position to string
   *
   * @param pos Position
   * @param yaw Yaw in degrees
   * @returns Position string with optional yaw
   */
  static posToString(pos: Vector3, yaw = 0): string {
    const position = `${this.posToStringSimple(pos)} ${(
      Math.abs(pos.y) / 10
    ).toFixed(2)}a`
    return yaw ? `${position} ${yaw}` : position
  }

  static altToString(pos: Vector3): string {
    return pos.y.toFixed(2)
  }

  static stringToPos(pos: string): Vector3 {
    const r = new Vector3()
    const [, zNum, , zHemi, xNum, , xHemi, , yNum] =
      /([+-]?(\d*\.)?\d+)(N|S)\s([+-]?(\d*\.)?\d+)(W|E)(\s([+-]?(\d*\.)?\d+)a)?/i.exec(
        pos
      ) || []
    if (zNum && xNum) {
      r.set(
        Number.parseFloat(xNum) * (xHemi.toUpperCase() === 'W' ? 10 : -10),
        (Number.parseFloat(yNum) || 0) * 10,
        Number.parseFloat(zNum) * (zHemi.toUpperCase() === 'N' ? 10 : -10)
      )
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
    return ((value + Math.PI) % (2 * Math.PI)) - Math.PI
  }

  /**
   * Converts RGB values to an hex color number
   *
   * @param red Red value
   * @param green Green value
   * @param blue Blue value
   * @returns Hex color value
   */
  static rgbToHex(red: number, green: number, blue: number): number {
    return blue | (green << 8) | (red << 16)
  }

  /**
   * Converts an hex color to RGB values
   *
   * @param hex Color number
   * @returns RGB values array
   */
  static hexToRgb(hex: number): number[] {
    return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255]
  }

  /**
   * Converts a color string to an hex color
   *
   * @param color Color string
   * @returns Hex color value
   */
  static colorStrToHex(color: string): number {
    return parseInt(color.substring(1), 16)
  }

  /**
   * Converts an hex color to string
   *
   * @param color Hex color
   * @returns Color string
   */
  static colorHexToStr(color: number): string {
    return '#' + `00000${color.toString(16)}`.slice(-6)
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

  /**
   * Find objects by userData attribute
   * @param node The node to traverse
   * @param key Which attribute to look for (e.g. name)
   * @param value The value to search
   * @returns List of matching objects
   */
  static getObjectsByUserData(node: Object3D, key: string, value: string) {
    const objs = []
    node.traverse((obj: Object3D) => {
      if (obj.userData[key] === value) {
        objs.push(obj)
      }
    })
    return objs
  }

  /**
   * Get all children objects recursively
   * @param object Object3D to traverse
   * @param children Array of the children (empty by default)
   * @returns Array of children
   */
  static getMeshes(object: Object3D, children = []) {
    if (object instanceof Mesh) {
      children.push(object)
    }
    object.children.forEach((child) => {
      if (child instanceof Mesh) {
        children.push(child)
      }
      if (child.children.length > 0) {
        Utils.getMeshes(child, children)
      }
    })
    return children
  }
}
