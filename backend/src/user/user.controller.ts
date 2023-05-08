import {Body, Controller, Delete, Get, Headers, Post, Res} from '@nestjs/common'
import {JwtService} from '@nestjs/jwt'
import {UserService} from './user.service'
import type {FastifyReply} from 'fastify'
import {config} from '../app.config'

@Controller('/api/v1/auth')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService
  ) {}

  @Get('/')
  authSession(@Headers('cookie') cookie: string, @Res() res: FastifyReply) {
    const user = this.userService.getUserFromCookie(cookie)
    if (user.id != null) {
      return res.status(200).send({id: user.id, name: user.name})
    }
    return res.status(401).send()
  }

  @Post('/')
  authLogin(
    @Body() params: {login: string; password: string},
    @Res({passthrough: true}) res: FastifyReply
  ) {
    const user = this.userService.login(params.login)
    const newToken = this.jwtService.sign({id: user.id})
    res.setCookie(config.cookie.access, newToken, {
      httpOnly: true,
      secure: false
    })
    return res.status(200).send(user)
  }

  @Delete('/')
  authLogout(@Res({passthrough: true}) res: FastifyReply) {
    res.clearCookie(config.cookie.access, {
      httpOnly: true,
      secure: false
    })
    return res.status(200).send(this.userService.logout())
  }
}