import {Injectable, Inject} from '@nestjs/common'
import {CACHE_MANAGER} from '@nestjs/cache-manager'
import {Cache} from 'cache-manager'
import {DbService} from '../db/db.service'
import {World} from './world'

@Injectable()
export class WorldService {
  constructor(
    @Inject(CACHE_MANAGER) private cache: Cache,
    private readonly db: DbService
  ) {}

  async getList() {
    return await this.db.world.findMany()
  }

  async getWorld(id: number) {
    const world = await this.db.world.findFirst({where: {id}})
    if (world != null) {
      const attr = JSON.parse(world.data ?? '{}')
      return new World({
        id: world.id,
        name: world.name,
        ...attr
      })
    }
    return new World()
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
    const orClause: {
      x?: {gte?: number; lt?: number}
      y?: {gte?: number; lt?: number}
      z?: {gte?: number; lt?: number}
    }[] = []
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

    // Ignore Y for cache keys
    const cacheKey = `P-${wid}-${minX}-${maxX}-${minZ}-${maxZ}`
    let props = await this.cache.get(cacheKey)

    if (props == null) {
      props = await this.db.prop.findMany({
        select: {
          id: true,
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
      await this.cache.set(cacheKey, props)
    }
    return props
  }

  async getTerrainPage(wid: number, pageX: number, pageZ: number) {
    const cacheKey = `T-${wid}-${pageX}-${pageZ}`
    let page: Partial<{[key: number]: [number, number]}> | undefined =
      await this.cache.get(cacheKey)

    if (page == null) {
      page = {}
      for (const elev of await this.db.elev.findMany({
        select: {
          node_x: true,
          node_z: true,
          radius: true,
          textures: true,
          heights: true
        },
        where: {AND: [{wid}, {page_x: pageX}, {page_z: pageZ}]}
      })) {
        const width = elev.radius * 2
        const textures = (elev.textures ?? '')
          .split(' ')
          .map((n: string) => parseInt(n))
        const heights = (elev.heights ?? '')
          .split(' ')
          .map((n: string) => parseInt(n))
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
            page[cell] = [texture, height]
          }
        }
      }
      await this.cache.set(cacheKey, page)
    }
    return page
  }
}
