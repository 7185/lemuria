import {CACHE_MANAGER, Cache} from '@nestjs/cache-manager'
import {Inject, Injectable} from '@nestjs/common'
import {and, eq, gte, lt, SQL} from 'drizzle-orm'
import {DbService} from '../db/db.service.js'
import {elev, prop, world} from '../db/schema.js'
import {World} from './world.js'

@Injectable()
export class WorldService {
  constructor(
    @Inject(CACHE_MANAGER) private cache: Cache,
    private readonly db: DbService
  ) {}

  async getList() {
    return await this.db.db.select().from(world)
  }

  async getWorld(id: number) {
    const [found] = await this.db.db
      .select()
      .from(world)
      .where(eq(world.id, id))
      .limit(1)
    if (found == null) {
      return new World()
    }
    const attr = JSON.parse(found.data ?? '{}')
    return new World({
      id: found.id,
      name: found.name,
      ...attr
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
    // Having a null value on one of those coordinate criteria means no bound will be applied when querying all objects
    const conditions: SQL[] = [eq(prop.wid, wid)]
    if (minX != null) {
      conditions.push(gte(prop.x, minX))
    }
    if (maxX != null) {
      conditions.push(lt(prop.x, maxX))
    }
    if (minY != null) {
      conditions.push(gte(prop.y, minY))
    }
    if (maxY != null) {
      conditions.push(lt(prop.y, maxY))
    }
    if (minZ != null) {
      conditions.push(gte(prop.z, minZ))
    }
    if (maxZ != null) {
      conditions.push(lt(prop.z, maxZ))
    }

    // Ignore Y for cache keys
    const cacheKey = `P-${wid}-${minX}-${maxX}-${minZ}-${maxZ}`
    let props = await this.cache.get(cacheKey)

    if (props == null) {
      props = await this.db.db
        .select({
          id: prop.id,
          date: prop.date,
          name: prop.name,
          x: prop.x,
          y: prop.y,
          z: prop.z,
          pi: prop.pi,
          ya: prop.ya,
          ro: prop.ro,
          desc: prop.desc,
          act: prop.act
        })
        .from(prop)
        .where(and(...conditions))
      await this.cache.set(cacheKey, props)
    }
    return props
  }

  async getTerrainPage(wid: number, pageX: number, pageZ: number) {
    const cacheKey = `T-${wid}-${pageX}-${pageZ}`
    let page: Partial<Record<number, [number, number]>> | undefined =
      await this.cache.get(cacheKey)
    if (page == null) {
      page = {}
      const elevs = await this.db.db
        .select({
          node_x: elev.node_x,
          node_z: elev.node_z,
          radius: elev.radius,
          textures: elev.textures,
          heights: elev.heights
        })
        .from(elev)
        .where(
          and(eq(elev.wid, wid), eq(elev.page_x, pageX), eq(elev.page_z, pageZ))
        )
      for (const e of elevs) {
        const width = e.radius * 2
        const textures = (e.textures ?? '')
          .split(' ')
          .map((n: string) => parseInt(n))
        const heights = (e.heights ?? '')
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
            const cell = row + j + e.node_x + e.node_z * 128
            page[cell] = [texture, height]
          }
        }
      }
      await this.cache.set(cacheKey, page)
    }
    return page
  }
}
