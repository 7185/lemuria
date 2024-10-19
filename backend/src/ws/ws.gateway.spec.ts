import {UserService} from '../user/user.service'
import {UserModule} from '../user/user.module'
import {User} from '../user/user'
import {Test, TestingModule} from '@nestjs/testing'
import {WsGateway} from './ws.gateway'
import {IncomingMessage} from 'http'
import {WebSocket} from 'ws'

describe(WsGateway.name, () => {
  let gateway: WsGateway

  beforeAll(async () => {
    const mockUser = {
      authorizedUsers: new Set([new User({id: 'dummy', name: 'alice'})]),
      getUserFromAccessCookie: jest.fn((x) => x)
    }
    const module: TestingModule = await Test.createTestingModule({
      imports: [UserModule],
      providers: [WsGateway]
    })
      .overrideProvider(UserService)
      .useValue(mockUser)
      .compile()

    gateway = module.get<WsGateway>(WsGateway)
  })

  it('should be defined', () => {
    expect(gateway).toBeDefined()
  })

  describe('handleConnection', () => {
    it('new connection', () => {
      const clientMock = {
        close: jest.fn((x) => x),
        send: jest.fn((x) => x)
      } as unknown as WebSocket
      const requestMock = {headers: {cookie: ''}} as IncomingMessage
      expect(gateway.handleConnection(clientMock, requestMock)).toStrictEqual(
        undefined
      )
    })
  })

  describe('handleDisconnect', () => {
    it('close connection', () => {
      const clientMock = {
        close: jest.fn((x) => x),
        send: jest.fn((x) => x)
      }
      expect(gateway.handleDisconnect(clientMock)).toStrictEqual(undefined)
    })
  })
})
