import {Injectable} from '@nestjs/common'
import {DbService} from '../db/db.service'
import {World} from './world'
import * as fs from 'fs/promises'

@Injectable()
export class WorldService {
  constructor(private readonly db: DbService) {}

  async getList() {
    return await this.db.world.findMany()
  }

  async getWorld(id: number) {
    const world = await this.db.world.findFirst({where: {id}})
    const attr = JSON.parse(world.data)
    if (attr.enable_terrain != null) {
      attr.terrain = attr.enable_terrain
      delete attr.enable_terrain
    }
    if (attr.enable_fog != null) {
      attr.fog = attr.enable_fog
      delete attr.enable_fog
    }

    return new World({
      id: world.id,
      name: world.name,
      ...attr,
      elev: await WorldService.buildElev(world.name)
    })
  }

  async getProps(
    wid: number,
    minX: number | null,
    maxX: number | null,
    minY: number | null,
    maxY: number | null,
    minZ: number | null,
    maxZ: number | null
  ) {
    // Having a null value on one of those coordinate criterias means no bound will be applied when querying all objects
    const orClause = []
    if (minX != null) {
      orClause.push({x: {gte: minX}})
    }
    if (maxX != null) {
      orClause.push({x: {lt: maxX}})
    }
    if (minY != null) {
      orClause.push({y: {gte: minY}})
    }
    if (maxY != null) {
      orClause.push({y: {lt: maxY}})
    }
    if (minZ != null) {
      orClause.push({z: {gte: minZ}})
    }
    if (maxZ != null) {
      orClause.push({z: {lt: maxZ}})
    }

    return await this.db.prop.findMany({
      select: {
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
      where: {AND: [{wid}, {AND: orClause}]}
    })
  }

  static async parseElevDump(name: string): Promise<{[index: string]: any[]}> {
    const elev: {[index: string]: any[]} = {}
    let file: string
    try {
      file = await fs.readFile(`dumps/elev${name.toLowerCase()}.txt`, 'latin1')
    } catch {
      return elev
    }
    const lines = file.trim().split('\n')
    for await (const line of lines) {
      const s = line.trim().split(' ')
      if (s[0] === 'elevdump') {
        continue
      }
      const coords = [parseInt(s[0]), parseInt(s[1])]
      const node: object = {
        node: [parseInt(s[2]), parseInt(s[3])],
        node_size: parseInt(s[4]),
        textures: s
          .slice(7, 7 + parseInt(s[5]))
          .map((x: string) => parseInt(x)),
        elevs: s
          .slice(7 + parseInt(s[5]), 7 + parseInt(s[5]) + parseInt(s[6]))
          .map((x: string) => parseInt(x))
      }
      const key = coords.toString()
      if (!elev[key]) {
        elev[key] = []
      }
      elev[key].push(node)
    }
    return elev
  }

  static async buildElev(name: string): Promise<object> {
    const d: object = {}
    const elev = await WorldService.parseElevDump(name)
    for (const [coordsStr, nodes] of Object.entries(elev)) {
      const coords = coordsStr.split(',').map((x) => parseInt(x))
      const xPage = 128 * coords[0]
      const zPage = 128 * coords[1]
      for (const n of nodes as Array<any>) {
        if (n.textures.length === 1) {
          n.textures = Array(64).fill(n.textures[0])
        }
        if (n.node_size === 4 && n.elevs.length > 1) {
          const size = n.node_size * 2
          const [xNode, zNode] = n.node
          for (let i = 0; i < size; i++) {
            const row = i * 128
            for (let j = 0; j < size; j++) {
              const elevIndex = size * i + j
              if (n.elevs[elevIndex] !== 0) {
                const key = row + j + xNode + zNode * 128
                if (!d[`${xPage}_${zPage}`]) {
                  d[`${xPage}_${zPage}`] = {}
                }
                d[`${xPage}_${zPage}`][key] = [
                  n.elevs[elevIndex],
                  n.textures[elevIndex]
                ]
              }
            }
          }
        }
      }
    }
    return d
  }
}
