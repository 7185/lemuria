import {Test, TestingModule} from '@nestjs/testing'
import {JwtModule} from '@nestjs/jwt'
import {User} from './user'
import {UserController} from './user.controller'
import {UserService} from './user.service'
import type {FastifyReply} from 'fastify'
import {config} from '../app.config'

describe('UserController', () => {
  let offlineController: UserController
  let controller: UserController

  beforeEach(async () => {
    const offlineModule: TestingModule = await Test.createTestingModule({
      imports: [JwtModule.register({secret: config.secret})],
      controllers: [UserController],
      providers: [UserService]
    }).compile()

    offlineController = offlineModule.get<UserController>(UserController)

    const mockUser = {
      getUserFromAccessCookie: () => new User({id: 'dummy'})
    }
    const module: TestingModule = await Test.createTestingModule({
      imports: [JwtModule],
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
      const statusResponseMock = {
        send: jest.fn((x) => x)
      }
      const responseMock = {
        status: jest.fn().mockReturnValue(statusResponseMock),
        setCookie: jest.fn(),
        send: jest.fn((x) => x)
      } as unknown as FastifyReply
      offlineController.authLogin(
        {
          login: '',
          password: 'P@$$w0rd!'
        },
        responseMock
      )
      expect(responseMock.status).toHaveBeenCalledWith(200)
      expect(statusResponseMock.send).toHaveBeenCalledWith({
        name: expect.stringMatching('Anonymous[0-9a-f]{8}'),
        id: expect.stringMatching('[0-9a-f]{8}')
      })
    })
  })

  describe('authSession', () => {
    it('should return 401', () => {
      const statusResponseMock = {
        send: jest.fn((x) => x)
      }
      const responseMock = {
        status: jest.fn().mockReturnValue(statusResponseMock),
        send: jest.fn((x) => x)
      } as unknown as FastifyReply
      offlineController.authSession('cookie', responseMock)
      expect(responseMock.status).toHaveBeenCalledWith(401)
    })
    it('should return 200', () => {
      const statusResponseMock = {
        send: jest.fn((x) => x)
      }
      const responseMock = {
        status: jest.fn().mockReturnValue(statusResponseMock),
        send: jest.fn((x) => x)
      } as unknown as FastifyReply
      expect(controller.authSession('cookie', responseMock)).toStrictEqual({
        id: 'dummy',
        name: undefined
      })
      expect(responseMock.status).toHaveBeenCalledWith(200)
    })
  })

  describe('authLogout', () => {
    const statusResponseMock = {
      send: jest.fn((x) => x)
    }
    const responseMock = {
      status: jest.fn().mockReturnValue(statusResponseMock),
      clearCookie: jest.fn(),
      send: jest.fn((x) => x)
    } as unknown as FastifyReply
    it('should return empty', () => {
      expect(
        offlineController.authLogout('cookie', responseMock)
      ).toStrictEqual({})
      expect(responseMock.status).toHaveBeenCalledWith(200)
    })
  })
})
