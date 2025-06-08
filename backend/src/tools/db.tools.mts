import fs from 'fs/promises'
import readline from 'readline'
import {PrismaBetterSQLite3} from '@prisma/adapter-better-sqlite3'
import {PrismaClient} from '../generated/prisma'

const db = new PrismaClient({
  adapter: new PrismaBetterSQLite3({
    url: process.env.ADAPTER_URL
  })
})

const worldAttr: Record<number, string> = {
  0: 'name',
  3: 'path',
  11: 'light.fog.color.r',
  12: 'light.fog.color.g',
  13: 'light.fog.color.b',
  25: 'welcome',
  41: 'light.dir.x',
  42: 'light.dir.y',
  43: 'light.dir.z',
  44: 'light.dir_color.r',
  45: 'light.dir_color.g',
  46: 'light.dir_color.b',
  47: 'light.amb_color.r',
  48: 'light.amb_color.g',
  49: 'light.amb_color.b',
  51: 'light.fog.enabled',
  52: 'light.fog.min',
  53: 'light.fog.max',
  61: 'sky.skybox',
  64: 'keywords',
  65: 'terrain.enabled',
  69: 'entry',
  70: 'sky.top_color.r',
  71: 'sky.top_color.g',
  72: 'sky.top_color.b',
  73: 'sky.north_color.r',
  74: 'sky.north_color.g',
  75: 'sky.north_color.b',
  76: 'sky.east_color.r',
  77: 'sky.east_color.g',
  78: 'sky.east_color.b',
  79: 'sky.south_color.r',
  80: 'sky.south_color.g',
  81: 'sky.south_color.b',
  82: 'sky.west_color.r',
  83: 'sky.west_color.g',
  84: 'sky.west_color.b',
  85: 'sky.bottom_color.r',
  86: 'sky.bottom_color.g',
  87: 'sky.bottom_color.b',
  111: 'water.texture_top',
  112: 'water.opacity',
  113: 'water.color.r',
  114: 'water.color.g',
  115: 'water.color.b',
  116: 'water.offset',
  120: 'water.texture_bottom',
  123: 'water.enabled',
  130: 'terrain.ambient',
  131: 'terrain.diffuse',
  132: 'water.under_view',
  141: 'terrain.offset'
}

async function* loadPropdump(filePath: string): AsyncGenerator<any[]> {
  const fileHandle = await fs.open(filePath, 'r')
  const fileStream = fileHandle.createReadStream({encoding: 'latin1'})
  const lines = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  })

  for await (let line of lines) {
    if (line.startsWith('propdump')) continue

    line = line.replace(/\x80\x7f/g, '\r\n').replace(/\x7f/g, '\n')
    const parts = line
      .split(' ')
      .reduce(
        (acc, cur, idx) =>
          idx < 12
            ? [...acc, cur]
            : [...acc.slice(0, -1), `${acc[acc.length - 1]} ${cur}`],
        []
      )

    if (parts.length < 12) continue

    const data = parts[11]
    const objLen = parseInt(parts[8])
    const descLen = parseInt(parts[9])
    const actLen = parseInt(parts[10])

    yield [
      parseInt(parts[1]),
      data.slice(0, objLen),
      parseInt(parts[2]),
      parseInt(parts[3]),
      parseInt(parts[4]),
      parseInt(parts[6]),
      parseInt(parts[5]),
      parseInt(parts[7]),
      descLen > 0 ? data.slice(objLen, objLen + descLen) : null,
      actLen > 0
        ? data.slice(objLen + descLen, objLen + descLen + actLen)
        : null
    ]
  }

  await fileHandle.close()
}

const parseAtdump = async (attrFile: string): Promise<any> => {
  const attrDict: any = {}

  for await (const [key, value] of loadAtdump(attrFile)) {
    const path = worldAttr[key]
    if (!path) continue

    const keys = path.split('.')
    let target = attrDict

    for (const k of keys.slice(0, -1)) {
      if (!(k in target)) {
        target[k] = k.endsWith('color') ? [0, 0, 0] : {}
      }
      target = target[k]
    }

    const lastKey = keys[keys.length - 1]
    if (lastKey === 'enabled') {
      target[lastKey] = value === 'Y'
    } else if ('rgb'.includes(lastKey)) {
      const colorIndex = 'rgb'.indexOf(lastKey)
      target[colorIndex] = parseInt(value)
    } else {
      target[lastKey] = !isNaN(Number(value)) ? Number(value) : value
    }
  }

  return attrDict
}

async function* loadAtdump(filePath: string): AsyncGenerator<[number, string]> {
  const fileHandle = await fs.open(filePath, 'r')
  const fileStream = fileHandle.createReadStream({encoding: 'latin1'})
  const lines = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  })
  for await (const line of lines) {
    const parts = line.split(' ', 2)
    if (parts[0] === 'atdump') continue
    yield [parseInt(parts[0]), parts[1].trim()]
  }

  await fileHandle.close()
}

async function* loadElevdump(
  filePath: string
): AsyncGenerator<
  [number, number, number, number, number, number[], number[]]
> {
  const fileHandle = await fs.open(filePath, 'r')
  const fileStream = fileHandle.createReadStream({encoding: 'latin1'})
  const lines = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  })
  for await (const line of lines) {
    const parts = line.split(' ')
    if (parts[0] === 'elevdump') continue
    yield [
      parseInt(parts[0]),
      parseInt(parts[1]),
      parseInt(parts[2]),
      parseInt(parts[3]),
      parseInt(parts[4]),
      parts.slice(7, 7 + parseInt(parts[5])).map(Number),
      parts.slice(7 + parseInt(parts[5])).map(Number)
    ]
  }

  await fileHandle.close()
}

const saveElevdump = async (worldName: string, file: string): Promise<void> => {
  const fileHandle = await fs.open(file, 'w')
  await fileHandle.write('elevdump version 1\r\n')

  const worlds: any[] =
    await db.$queryRaw`SELECT * FROM world WHERE LOWER(name) = ${worldName.toLowerCase()}`
  const world = worlds[0]

  if (!world) {
    console.log('World not found')
    await fileHandle.close()
    return
  }

  const elevs = await db.elev.findMany({
    where: {wid: world.id}
  })

  for (const elev of elevs) {
    await fileHandle.write(
      `${elev.page_x} ${elev.page_z} ${elev.node_x} ${elev.node_z} ` +
        `${elev.radius} ${elev.textures?.split(' ').length} ` +
        `${elev.heights?.split(' ').length} ${elev.textures} ${elev.heights}\r\n`
    )
  }

  await fileHandle.close()
}

const savePropdump = async (worldName: string, file: string): Promise<void> => {
  const fileHandle = await fs.open(file, 'w')
  await fileHandle.write('propdump version 3\r\n')

  const worlds: any[] =
    await db.$queryRaw`SELECT * FROM world WHERE LOWER(name) = ${worldName.toLowerCase()}`
  const world = worlds[0]

  if (!world) {
    console.log('World not found')
    await fileHandle.close()
    return
  }

  const props = await db.prop.findMany({
    select: {
      id: true,
      uid: true,
      date: true,
      name: true,
      x: true,
      y: true,
      z: true,
      pi: true,
      ya: true,
      ro: true,
      desc: true,
      act: true
    },
    where: {wid: world.id}
  })

  for (const prop of props) {
    const line = `${prop.uid} ${prop.date} ${prop.x} ${prop.y} ${prop.z} ${prop.ya} ${prop.pi} ${prop.ro} ${prop.name.length} ${prop.desc?.length || 0} ${prop.act?.length || 0} ${prop.name}${(prop.desc ?? '').replace(/\r\n/g, '\x80\x7f').replace(/\n/g, '\x7f')}${(prop.act ?? '').replace(/\r\n/g, '\x80\x7f').replace(/\n/g, '\x7f')}`
    await fileHandle.write(`${line}\r\n`)
  }

  await fileHandle.close()
}

const saveAtdump = async (worldName: string, file: string): Promise<void> => {
  const worlds: any[] =
    await db.$queryRaw`SELECT * FROM world WHERE LOWER(name) = ${worldName.toLowerCase()}`
  const world = worlds[0]

  if (!world) {
    console.log('World not found')
    return
  }

  const attrDict = JSON.parse(world.data ?? '{}')
  const reverseWorldAttr: Record<string, number> = Object.fromEntries(
    Object.entries(worldAttr).map(([k, v]) => [v, parseInt(k)])
  )

  const lines = Object.entries(flattenDict(attrDict))
    .map(([key, value]) => [reverseWorldAttr[key], value])
    .sort((a, b) => (a[0] as number) - (b[0] as number))

  const fileHandle = await fs.open(file, 'w')
  await fileHandle.write('atdump version 1\r\n')

  for (const [num, value] of lines) {
    if (num == null) continue
    await fileHandle.write(`${num} ${value}\r\n`)
  }

  await fileHandle.close()
}

export const importWorld = async (
  worldName: string,
  path = '../dumps'
): Promise<void> => {
  let admin = await db.user.findFirst({where: {name: 'admin'}})
  if (!admin) {
    admin = await db.user.create({
      data: {name: 'admin', password: '', email: ''}
    })
  }

  const attrDict = await parseAtdump(`${path}/at${worldName}.txt`)

  const worlds: any[] =
    await db.$queryRaw`SELECT * FROM world WHERE LOWER(name) = ${worldName.toLowerCase()}`
  let world = worlds[0]

  if (!world) {
    world = await db.world.create({
      data: {name: attrDict.name, data: JSON.stringify(attrDict)}
    })
  } else {
    world = await db.world.update({
      where: {id: world.id},
      data: {name: attrDict.name, data: JSON.stringify(attrDict)}
    })
  }

  await db.prop.deleteMany({where: {wid: world.id}})
  await db.elev.deleteMany({where: {wid: world.id}})

  await db.$transaction(async (prisma) => {
    for await (const e of loadElevdump(`${path}/elev${worldName}.txt`)) {
      await prisma.elev.create({
        data: {
          wid: world.id,
          page_x: e[0] as number,
          page_z: e[1],
          node_x: e[2],
          node_z: e[3],
          radius: e[4],
          textures: e[5].join(' '),
          heights: e[6].join(' ')
        }
      })
    }

    for await (const o of loadPropdump(`${path}/prop${worldName}.txt`)) {
      await prisma.prop.create({
        data: {
          wid: world.id,
          uid: admin.id,
          date: o[0],
          name: o[1],
          x: o[2],
          y: o[3],
          z: o[4],
          pi: o[5],
          ya: o[6],
          ro: o[7],
          desc: o[8],
          act: o[9]
        }
      })
    }
  })
}

export const exportWorld = async (
  worldName: string,
  path = '../dumps'
): Promise<void> => {
  await saveAtdump(worldName, `${path}/export_at${worldName}.txt`)
  await saveElevdump(worldName, `${path}/export_elev${worldName}.txt`)
  await savePropdump(worldName, `${path}/export_prop${worldName}.txt`)
}

const flattenDict = (nestedDict: any, separator = '.'): Record<string, any> => {
  const flatten = (obj: any, prefix = ''): Record<string, any> => {
    return Object.keys(obj).reduce((acc: Record<string, any>, k: string) => {
      const pre = prefix.length ? prefix + separator : ''
      if (
        typeof obj[k] === 'object' &&
        obj[k] !== null &&
        !Array.isArray(obj[k])
      ) {
        Object.assign(acc, flatten(obj[k], pre + k))
      } else if (Array.isArray(obj[k])) {
        acc[pre + k] = {r: obj[k][0], g: obj[k][1], b: obj[k][2]}
      } else {
        acc[pre + k] =
          typeof obj[k] === 'boolean' ? (obj[k] ? 'Y' : 'N') : obj[k]
      }
      return acc
    }, {})
  }

  return flatten(nestedDict)
}
