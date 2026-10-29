import type {NodeResponse} from '@nestjs/platform-node'
import {UnauthorizedException} from '@nestjs/common'
import {JwtModule} from '@nestjs/jwt'
import {Test, TestingModule} from '@nestjs/testing'
import {config} from '../app.config.js'
import {UserController} from './user.controller.js'
import {User} from './user.js'
import {UserService} from './user.service.js'

describe(UserController.name, () => {
  let offlineController: UserController
  let controller: UserController

  beforeAll(async () => {
    const offlineModule: TestingModule = await Test.createTestingModule({
      imports: [JwtModule.register({secret: config.secret})],
      controllers: [UserController],
      providers: [UserService]
    }).compile()

    offlineController = offlineModule.get<UserController>(UserController)

    const mockUser = {
      getUserFromAccessCookie: () => new User({id: 'dummy'}),
      getUserFromRefreshCookie: () => new User({id: 'dummy'})
    }
    const module: TestingModule = await Test.createTestingModule({
      imports: [JwtModule.register({secret: config.secret})],
      controllers: [UserController],
      providers: [UserService]
    })
      .overrideProvider(UserService)
      .useValue(mockUser)
      .compile()

    controller = module.get<UserController>(UserController)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })

  describe('authLogin', () => {
    it('should return username and id', () => {
      const responseMock = {cookie: vi.fn()} as unknown as NodeResponse
      expect(
        offlineController.authLogin(
          {
            login: '',
            password: 'P@$$w0rd!'
          },
          responseMock
        )
      ).toStrictEqual({
        name: expect.stringMatching('Anonymous[0-9a-f]{8}'),
        id: expect.stringMatching('[0-9a-f]{8}')
      })
    })
  })

  describe('authSession', () => {
    it('should return 401', () => {
      expect(() => offlineController.authSession('cookie')).toThrow(
        UnauthorizedException
      )
    })

    it('should return 200', () => {
      expect(controller.authSession('cookie')).toStrictEqual({
        id: 'dummy',
        name: 'Anonymous'
      })
    })
  })

  describe('authLogout', () => {
    it('should return empty', () => {
      const responseMock = {
        clearCookie: vi.fn()
      } as unknown as NodeResponse

      expect(
        offlineController.authLogout('cookie', responseMock)
      ).toStrictEqual({})
      expect(responseMock.clearCookie).toHaveBeenCalled()
    })
  })

  describe('authRenew', () => {
    it('should return 401', () => {
      const responseMock = {
        cookie: vi.fn()
      } as unknown as NodeResponse

      expect(() => offlineController.authRenew('cookie', responseMock)).toThrow(
        UnauthorizedException
      )
    })

    it('should return 200', () => {
      const responseMock = {
        cookie: vi.fn()
      } as unknown as NodeResponse

      expect(controller.authRenew('cookie', responseMock)).toStrictEqual({
        id: 'dummy',
        name: 'Anonymous'
      })
      expect(responseMock.cookie).toHaveBeenCalled()
    })
  })
})
