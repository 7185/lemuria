import {Controller, Get, Param, Query} from '@nestjs/common'
import {WorldService} from './world.service'

@Controller('/api/v1/world')
export class WorldController {
  constructor(private readonly worldService: WorldService) {}

  @Get('/')
  async worldList() {
    return (await this.worldService.getList()).map((w) => {
      return {id: w.id, name: w.name, users: 0}
    })
  }

  @Get(':id')
  async worldGet(@Param('id') id: string) {
    const world = await this.worldService.getWorld(parseInt(id))
    return {
      id: world.id,
      name: world.name,
      welcome: world.welcome,
      path: world.path,
      sky_color: world.sky_color,
      skybox: world.skybox,
      entry: world.entry,
      terrain: world.terrain,
      elev: world.elev
    }
  }

  @Get(':id/props')
  async worldProps(
    @Param('id') id: string,
    @Query()
    query: {
      min_x?: string
      max_x?: string
      min_y?: string
      max_y?: string
      min_z?: string
      max_z?: string
    }
  ) {
    const min_x = /^-?\d+$/.test(query.min_x) ? parseInt(query.min_x) : null
    const max_x = /^-?\d+$/.test(query.max_x) ? parseInt(query.max_x) : null
    const min_y = /^-?\d+$/.test(query.min_y) ? parseInt(query.min_y) : null
    const max_y = /^-?\d+$/.test(query.max_y) ? parseInt(query.max_y) : null
    const min_z = /^-?\d+$/.test(query.min_z) ? parseInt(query.min_z) : null
    const max_z = /^-?\d+$/.test(query.max_z) ? parseInt(query.max_z) : null

    const entries = (
      await this.worldService.getProps(
        parseInt(id),
        min_x,
        max_x,
        min_y,
        max_y,
        min_z,
        max_z
      )
    ).map((e) => Object.values(e))

    return {entries}
  }
}
