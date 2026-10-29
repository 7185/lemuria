import type {IncomingMessage} from 'http'
import type {Server, WebSocket} from 'ws'
import {Test, TestingModule} from '@nestjs/testing'
import {User} from '../user/user.js'
import {UserModule} from '../user/user.module.js'
import {UserService} from '../user/user.service.js'
import {WsGateway} from './ws.gateway.js'

describe(WsGateway.name, () => {
  let gateway: WsGateway
  let validUser: User
  let mockUserService: {
    authorizedUsers: Set<User>
    getUserFromAccessCookie: ReturnType<typeof vi.fn>
    broadcast: ReturnType<typeof vi.fn>
    broadcastUserlist: ReturnType<typeof vi.fn>
    sendPosition: ReturnType<typeof vi.fn>
  }

  beforeEach(async () => {
    vi.useFakeTimers()

    validUser = new User({id: 'dummy', name: 'alice'})

    mockUserService = {
      authorizedUsers: new Set([validUser]),
      getUserFromAccessCookie: vi.fn((cookie: string) =>
        cookie === 'valid_cookie' ? validUser : new User({})
      ),
      broadcast: vi.fn(),
      broadcastUserlist: vi.fn(),
      sendPosition: vi.fn()
    }
    const module: TestingModule = await Test.createTestingModule({
      imports: [UserModule],
      providers: [WsGateway]
    })
      .overrideProvider(UserService)
      .useValue(mockUserService)
      .compile()

    gateway = module.get<WsGateway>(WsGateway)
  })

  afterEach(() => {
    validUser.positionTimer?.unsubscribe()
    validUser.heartbeat?.unsubscribe()
    vi.useRealTimers()
  })

  it('should be defined', () => {
    expect(gateway).toBeDefined()
  })

  describe('handleConnection', () => {
    it('should close connection if user is not authenticated', () => {
      const clientMock = {
        close: vi.fn(),
        ping: vi.fn()
      } as unknown as WebSocket
      const requestMock = {headers: {cookie: 'invalid'}} as IncomingMessage

      gateway.handleConnection(clientMock, requestMock)

      expect(clientMock.close).toHaveBeenCalled()
      expect(validUser.connected).toBeFalsy()
      expect(mockUserService.broadcast).not.toHaveBeenCalled()
    })

    it('should register user websocket, start timers and broadcast join', () => {
      const clientMock = {
        close: vi.fn(),
        ping: vi.fn()
      } as unknown as WebSocket
      const requestMock = {
        headers: {cookie: 'valid_cookie'}
      } as IncomingMessage

      gateway.handleConnection(clientMock, requestMock)

      expect(clientMock.close).not.toHaveBeenCalled()
      expect(validUser.connected).toBe(true)
      expect(validUser.websockets.has(clientMock)).toBe(true)

      expect(mockUserService.broadcastUserlist).toHaveBeenCalled()
      expect(mockUserService.broadcast).toHaveBeenCalledWith({
        type: 'join',
        data: 'dummy'
      })

      vi.advanceTimersByTime(0)
      expect(mockUserService.sendPosition).toHaveBeenCalledWith(validUser)
      expect(clientMock.ping).toHaveBeenCalled()
    })
  })

  describe('handleDisconnect', () => {
    it('should remove websocket, stop timers and broadcast part when last socket closes', () => {
      const clientMock = {
        close: vi.fn(),
        ping: vi.fn()
      } as unknown as WebSocket
      const requestMock = {
        headers: {cookie: 'valid_cookie'}
      } as IncomingMessage

      gateway.handleConnection(clientMock, requestMock)
      expect(validUser.connected).toBe(true)

      gateway.handleDisconnect(clientMock)

      expect(validUser.websockets.has(clientMock)).toBe(false)
      expect(validUser.connected).toBe(false)
      expect(validUser.positionTimer?.closed).toBe(true)
      expect(validUser.heartbeat?.closed).toBe(true)
      expect(mockUserService.broadcast).toHaveBeenCalledWith({
        type: 'part',
        data: 'dummy'
      })
    })
  })

  describe('afterInit (message handling)', () => {
    it('should handle msg, pos and avatar messages', () => {
      let messageHandler!: (payload: string) => void

      const clientMock = {
        close: vi.fn(),
        on: vi.fn((event: string, cb: (payload: string) => void) => {
          if (event === 'message') messageHandler = cb
        })
      } as unknown as WebSocket

      gateway.server = {
        on: vi.fn((event: string, cb: any) => {
          if (event === 'connection') {
            cb(clientMock, {headers: {cookie: 'valid_cookie'}})
          }
        })
      } as unknown as Server

      gateway.afterInit()

      messageHandler(JSON.stringify({type: 'msg', data: 'Hello world'}))
      expect(mockUserService.broadcast).toHaveBeenCalledWith({
        type: 'msg',
        user: 'dummy',
        data: 'Hello world'
      })

      messageHandler(
        JSON.stringify({
          type: 'pos',
          data: {
            pos: {x: 1, y: 2, z: 3},
            ori: {x: 4, y: 5, z: 6},
            state: 'walk',
            gesture: 'wave'
          }
        })
      )
      expect(validUser.position).toEqual([1, 2, 3])
      expect(validUser.orientation).toEqual([4, 5, 6])
      expect(validUser.state).toBe('walk')
      expect(validUser.gesture).toBe('wave')

      messageHandler(JSON.stringify({type: 'avatar', data: 'avatar_01'}))
      expect(validUser.avatar).toBe('avatar_01')
      expect(mockUserService.broadcast).toHaveBeenCalledWith({
        type: 'avatar',
        user: 'dummy',
        data: 'avatar_01'
      })
    })
  })
})
