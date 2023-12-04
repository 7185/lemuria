const rgb = (red: number, green: number, blue: number) => {
  return {
    r: Math.max(0, Math.min(red, 255)),
    g: Math.max(0, Math.min(green, 255)),
    b: Math.max(0, Math.min(blue, 255))
  }
}

const PRESET_COLORS = {
  aquamarine: rgb(112, 219, 147),
  black: rgb(0, 0, 0),
  blue: rgb(0, 0, 255),
  brass: rgb(181, 166, 66),
  bronze: rgb(140, 120, 83),
  brown: rgb(166, 42, 42),
  copper: rgb(184, 115, 51),
  cyan: rgb(0, 255, 255),
  darkgrey: rgb(48, 48, 48),
  forestgreen: rgb(35, 142, 35),
  gold: rgb(205, 127, 50),
  green: rgb(0, 255, 0),
  grey: rgb(112, 112, 112),
  lightgrey: rgb(192, 192, 192),
  magenta: rgb(255, 0, 255),
  maroon: rgb(142, 35, 107),
  navyblue: rgb(35, 35, 142),
  orange: rgb(255, 127, 0),
  orangered: rgb(255, 36, 0),
  orchid: rgb(219, 112, 219),
  pink: rgb(255, 110, 199),
  red: rgb(255, 0, 0),
  salmon: rgb(111, 66, 66),
  scarlet: rgb(140, 23, 23),
  silver: rgb(230, 232, 250),
  skyblue: rgb(50, 153, 204),
  tan: rgb(219, 147, 112),
  teal: rgb(0, 112, 112),
  turquoise: rgb(173, 234, 234),
  violet: rgb(79, 47, 79),
  white: rgb(255, 255, 255),
  yellow: rgb(255, 255, 0)
}

export const colorStringToRGB = (color: string) => {
  if (color in PRESET_COLORS) {
    return PRESET_COLORS[color as keyof typeof PRESET_COLORS]
  }
  const extractedHex = RegExp(/(^[a-f0-9]+)/).exec(color.toLowerCase())
  if (extractedHex) {
    // Get first hexadecimal string match & convert to number
    const colorValue = parseInt(extractedHex[0], 16)
    if (colorValue > BigInt('18446744073709551615')) {
      // AW considers everything white at this point
      return rgb(255, 255, 255)
    } else {
      const red = (colorValue >> 16) % 256
      const green = (colorValue >> 8) % 256
      const blue = (colorValue >> 0) % 256
      return rgb(
        red < 0 ? red + 256 : red,
        green < 0 ? green + 256 : green,
        blue < 0 ? blue + 256 : blue
      )
    }
  }
  return null
}

export const visitCoords = (
  res: {commandType?: string; coordinates?: object},
  coordA: string,
  coordB: string,
  coordC: string,
  coordD: string
) => {
  res.coordinates = {}

  if (/^[+-]/.test(coordA) && /^[+-]/.test(coordB)) {
    Object.assign(res.coordinates, {
      coordinates: {
        coordinateType: 'relative',
        x: parseFloat(coordA),
        y: parseFloat(coordB)
      }
    })
  } else if (/[ns]$/i.test(coordA) && /[ew]$/i.test(coordB)) {
    const signA = /n$/i.test(coordA) ? 1 : -1
    const signB = /e$/i.test(coordB) ? 1 : -1

    Object.assign(res.coordinates, {
      coordinates: {
        coordinateType: 'absolute',
        NS: signA * parseFloat(coordA.slice(0, -1)),
        EW: signB * parseFloat(coordB.slice(0, -1))
      }
    })
  } else {
    // Invalid, delete all keys
    delete res.commandType
    delete res.coordinates
    return
  }
  if (coordC != null) {
    if (/a$/i.test(coordC)) {
      if (/^[+-]/.test(coordC)) {
        Object.assign(res.coordinates, {
          altitude: {
            altitudeType: 'relative',
            value: parseFloat(coordC.slice(0, -1))
          }
        })
      } else {
        Object.assign(res.coordinates, {
          altitude: {
            altitudeType: 'absolute',
            value: parseFloat(coordC.slice(0, -1))
          }
        })
      }
    } else {
      Object.assign(res.coordinates, {
        direction: parseFloat(coordC)
      })
    }
  }
  if (coordD != null) {
    // Can only be direction
    Object.assign(res.coordinates, {
      direction: parseFloat(coordD)
    })
  }
}
