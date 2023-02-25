import {Test, TestingModule} from '@nestjs/testing'
import {JwtModule} from '@nestjs/jwt'
import {UserController} from './user.controller'
import {UserService} from './user.service'
import type {FastifyReply} from 'fastify'

describe('UserController', () => {
  let controller: UserController

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [JwtModule.register({secret: '**changeme**'})],
      controllers: [UserController],
      providers: [UserService]
    }).compile()

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
      controller.authLogin(
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
      controller.authSession('cookie', responseMock)
      expect(responseMock.status).toHaveBeenCalledWith(401)
    })
  })

  describe('authLogout', () => {
    it('should return 200', () => {
      expect(controller.authLogout()).toStrictEqual({})
    })
  })
})
