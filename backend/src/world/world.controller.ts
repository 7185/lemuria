import {Controller, Get, Headers, Param, Query, Res} from '@nestjs/common'
import type {FastifyReply} from 'fastify'
import {UserService} from '../user/user.service'
import {WorldService} from './world.service'

@Controller('/api/v1/world')
export class WorldController {
  constructor(
    private readonly userService: UserService,
    private readonly worldService: WorldService
  ) {}

  @Get('/')
  async worldList() {
    return (await this.worldService.getList()).map((world: any) => {
      return {
        id: world.id,
        name: world.name,
        users: Array.from(this.userService.authorizedUsers).filter(
          (user) => user.connected && user.world === world.id
        ).length
      }
    })
  }

  @Get(':id')
  async worldGet(
    @Headers('cookie') cookie: string,
    @Param('id') id: string,
    @Res() res: FastifyReply
  ) {
    const user = this.userService.getUserFromCookie(cookie)
    if (!user.id) {
      return res.status(401).send()
    }
    const world = await this.worldService.getWorld(parseInt(id))
    user.world = parseInt(id)
    this.userService.broadcastUserlist()
    return res.status(200).send(Object.fromEntries(Object.entries(world)))
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
      (await this.worldService.getProps(
        parseInt(id),
        min_x,
        max_x,
        min_y,
        max_y,
        min_z,
        max_z
      )) as unknown[]
    ).map((e) => Object.values(e))

    return {entries}
  }
}
