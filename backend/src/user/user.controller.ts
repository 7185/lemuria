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
    const user = this.userService.getUserFromAccessCookie(cookie)
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
    const accessToken = this.jwtService.sign(
      {id: user.id},
      {expiresIn: config.cookie.accessExpires}
    )
    res.setCookie(config.cookie.accessName, accessToken, {
      httpOnly: true,
      secure: config.cookie.secure,
      sameSite: config.cookie.sameSite,
      path: config.cookie.accessPath
    })
    const refreshToken = this.jwtService.sign(
      {id: user.id},
      {expiresIn: config.cookie.refreshExpires}
    )
    res.setCookie(config.cookie.refreshName, refreshToken, {
      httpOnly: true,
      secure: config.cookie.secure,
      sameSite: config.cookie.sameSite,
      path: config.cookie.refreshPath
    })
    return res.status(200).send(user)
  }

  @Delete('/')
  authLogout(
    @Headers('cookie') cookie: string,
    @Res({passthrough: true}) res: FastifyReply
  ) {
    const user = this.userService.getUserFromAccessCookie(cookie)
    res.clearCookie(config.cookie.accessName, {
      httpOnly: true,
      secure: config.cookie.secure,
      sameSite: config.cookie.sameSite,
      path: config.cookie.accessPath
    })
    return res.status(200).send(this.userService.logout(user.id))
  }

  @Post('/renew')
  authRenew(@Headers('cookie') cookie: string, @Res() res: FastifyReply) {
    const user = this.userService.getUserFromRefreshCookie(cookie)
    const newToken = this.jwtService.sign(
      {id: user.id},
      {expiresIn: config.cookie.accessExpires}
    )
    res.setCookie(config.cookie.accessName, newToken, {
      httpOnly: true,
      secure: config.cookie.secure,
      sameSite: config.cookie.sameSite,
      path: config.cookie.accessPath
    })
    return res.status(200).send(user)
  }
}
