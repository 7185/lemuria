import {Mesh} from 'three'
import type {Object3D, Vector3Like} from 'three'

export const posToString = (pos: Vector3Like): string => {
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
export const posToStringYaw = (pos: Vector3Like, yaw = 0): string => {
  const position = `${posToString(pos)} ${(Math.abs(pos.y) / 10).toFixed(2)}a`
  return yaw ? `${position} ${yaw}` : position
}

export const altToString = (pos: Vector3Like): string => {
  return pos.y.toFixed(2)
}

export const stringToPos = (pos: string): Vector3Like => {
  const r = {x: 0, y: 0, z: 0}
  const [, zNum, , zHemi, xNum, , xHemi, , yNum] =
    /([+-]?([0-9]*\.)?[0-9]+)(N|S)\s([+-]?([0-9]*\.)?[0-9]+)(W|E)(\s([+-]?([0-9]*\.)?[0-9]+)a)?/i.exec(
      pos
    ) || []
  if (zNum && xNum) {
    Object.assign(r, {
      x: Number.parseFloat(xNum) * (xHemi.toUpperCase() === 'W' ? 10 : -10),
      y: (Number.parseFloat(yNum) || 0) * 10,
      z: Number.parseFloat(zNum) * (zHemi.toUpperCase() === 'N' ? 10 : -10)
    })
  }
  return r
}

export const modelName = (name: string) => {
  if (name.endsWith('.rwx')) {
    return name
  }
  if (name.endsWith('.zip')) {
    return name.slice(0, -4) + '.rwx'
  }
  return name + '.rwx'
}

export const radNormalized = (value: number): number => {
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
export const rgbToHex = (red: number, green: number, blue: number): number => {
  return blue | (green << 8) | (red << 16)
}

/**
 * Converts an hex color to RGB values
 *
 * @param hex Color number
 * @returns RGB values array
 */
export const hexToRgb = (hex: number): [number, number, number] => {
  return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255]
}

/**
 * Converts a color string to an hex color
 *
 * @param color Color string
 * @returns Hex color value
 */
export const colorStrToHex = (color: string): number => {
  return parseInt(color.substring(1), 16)
}

/**
 * Converts an hex color to string
 *
 * @param color Hex color
 * @returns Color string
 */
export const colorHexToStr = (color: number): string => {
  return '#' + `00000${color.toString(16)}`.slice(-6)
}

/**
 * Calculate the shortest angle between oldValue and newValue
 * @param oldValue First value
 * @param newValue Second value
 * @returns The result in the range [-PI, PI]
 */
export const shortestAngle = (oldValue: number, newValue: number): number => {
  return (
    ((((newValue - oldValue + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) %
      (2 * Math.PI)) -
    Math.PI
  )
}

/**
 * Find objects by userData attribute
 * @param node The node to traverse
 * @param key Which attribute to look for (e.g. name)
 * @param value The value to search
 * @returns List of matching objects
 */
export const getObjectsByUserData = (
  node: Object3D,
  key: string,
  value: string
) => {
  const objs: Object3D[] = []
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
export const getMeshes = (object: Object3D, children: Mesh[] = []) => {
  if (object instanceof Mesh) {
    children.push(object)
  }
  object.children.forEach((child) => {
    if (child instanceof Mesh) {
      children.push(child)
    }
    if (child.children.length > 0) {
      getMeshes(child, children)
    }
  })
  return children
}
