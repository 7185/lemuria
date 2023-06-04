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
      elev: await this.getElev(world.id)
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

  async getElev(wid: number) {
    const d: object = {}
    for (const elev of await this.db.elev.findMany({
      select: {
        page_x: true,
        page_z: true,
        node_x: true,
        node_z: true,
        radius: true,
        textures: true,
        heights: true
      },
      where: {wid}
    })) {
      const page = `${128 * elev.page_x}_${128 * elev.page_z}`
      page in d || (d[page] = {})
      const width = elev.radius * 2
      const textures = elev.textures.split(' ').map((n: string) => parseInt(n))
      const heights = elev.heights.split(' ').map((n: string) => parseInt(n))
      for (let i = 0; i < width; i++) {
        const row = i * 128
        for (let j = 0; j < width; j++) {
          const idx = width * i + j
          const texture = idx < textures.length ? textures[idx] : textures[0]
          const height = idx < heights.length ? heights[idx] : heights[0]
          if (texture === 0 && height === 0) {
            continue
          }
          const cell = row + j + elev.node_x + elev.node_z * 128
          d[page][cell] = [texture, height]
        }
      }
    }
    return d
  }
}
