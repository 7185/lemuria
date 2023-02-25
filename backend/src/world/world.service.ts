import {Injectable} from '@nestjs/common'
import {DbService} from '../db/db.service'
import {World} from './world'

@Injectable()
export class WorldService {
  constructor(private readonly db: DbService) {}

  async getList() {
    return await this.db.world.findMany()
  }

  async getWorld(id: number) {
    const world = await this.db.world.findFirst({where: {id}})
    return new World({
      id: world.id,
      name: world.name,
      ...JSON.parse(world.data)
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
    if (minX != null) orClause.push({x: {gte: minX}})
    if (maxX != null) orClause.push({x: {lt: maxX}})
    if (minY != null) orClause.push({y: {gte: minY}})
    if (maxY != null) orClause.push({y: {lt: maxY}})
    if (minZ != null) orClause.push({z: {gte: minZ}})
    if (maxZ != null) orClause.push({z: {lt: maxZ}})

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
}
