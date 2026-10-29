import type {NodeResponse} from '@nestjs/platform-node'
import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UnauthorizedException
} from '@nestjs/common'
import {JwtService} from '@nestjs/jwt'
import {config} from '../app.config.js'
import {UserService} from './user.service.js'

@Controller('/api/v1/auth')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService
  ) {}

  @Get('/')
  authSession(@Headers('cookie') cookie: string) {
    const user = this.userService.getUserFromAccessCookie(cookie)
    if (user.id == null) {
      throw new UnauthorizedException()
    }
    return {id: user.id, name: user.name}
  }

  @Post('/')
  @HttpCode(HttpStatus.OK)
  authLogin(
    @Body() params: {login: string; password: string},
    @Res({passthrough: true}) res: NodeResponse
  ) {
    const user = this.userService.login(params.login)
    const accessToken = this.jwtService.sign(
      {id: user.id},
      {expiresIn: config.cookie.accessExpires}
    )
    res.cookie(config.cookie.accessName, accessToken, {
      httpOnly: true,
      secure: config.cookie.secure,
      sameSite: config.cookie.sameSite,
      path: config.cookie.accessPath
    })
    const refreshToken = this.jwtService.sign(
      {id: user.id},
      {expiresIn: config.cookie.refreshExpires}
    )
    res.cookie(config.cookie.refreshName, refreshToken, {
      httpOnly: true,
      secure: config.cookie.secure,
      sameSite: config.cookie.sameSite,
      path: config.cookie.refreshPath
    })
    return user
  }

  @Delete('/')
  @HttpCode(HttpStatus.OK)
  authLogout(
    @Headers('cookie') cookie: string,
    @Res({passthrough: true}) res: NodeResponse
  ) {
    const user = this.userService.getUserFromAccessCookie(cookie)
    res.clearCookie(config.cookie.accessName, {
      httpOnly: true,
      secure: config.cookie.secure,
      sameSite: config.cookie.sameSite,
      path: config.cookie.accessPath
    })
    return this.userService.logout(user.id)
  }

  @Post('/renew')
  @HttpCode(HttpStatus.OK)
  authRenew(
    @Headers('cookie') cookie: string,
    @Res({passthrough: true}) res: NodeResponse
  ) {
    const user = this.userService.getUserFromRefreshCookie(cookie)
    if (user.id == null) {
      throw new UnauthorizedException()
    }
    const newToken = this.jwtService.sign(
      {id: user.id},
      {expiresIn: config.cookie.accessExpires}
    )
    res.cookie(config.cookie.accessName, newToken, {
      httpOnly: true,
      secure: config.cookie.secure,
      sameSite: config.cookie.sameSite,
      path: config.cookie.accessPath
    })
    return {id: user.id, name: user.name}
  }
}
