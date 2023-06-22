import {UserModule} from '../user/user.module'
import {UserService} from '../user/user.service'
import {Test, TestingModule} from '@nestjs/testing'
import {CACHE_MANAGER} from '@nestjs/cache-manager'
import type {FastifyReply} from 'fastify'
import {DbService} from '../db/db.service'
import {WorldController} from './world.controller'
import {WorldService} from './world.service'
import {User} from '../user/user'

describe('WorldController', () => {
  let controller: WorldController
  let offlineController: WorldController

  beforeEach(async () => {
    const mockDb = {
      world: {
        findFirst: () =>
          Promise.resolve({
            id: 1,
            name: 'Lemuria',
            data: '{"welcome": "Bienvenue sur Lemuria", "enable_terrain": false, "enable_fog": true}'
          }),
        findMany: () => Promise.resolve([{id: 1, name: 'Lemuria', data: '{}'}])
      },
      prop: {
        findMany: () =>
          Promise.resolve([[0, 'tracteur1', 0, 0, 0, 0, 0, 0, null, null]])
      },
      elev: {
        findMany: () => Promise.resolve([])
      }
    }
    const mockUser = {
      authorizedUsers: new Set([
        new User({id: 'dummy', name: 'alice', world: 1, connected: true})
      ]),
      getUserFromCookie: () => new User({id: 'dummy'}),
      broadcastUserlist: () => Promise.resolve()
    }
    const module: TestingModule = await Test.createTestingModule({
      imports: [UserModule],
      controllers: [WorldController],
      providers: [
        WorldService,
        DbService,
        {
          provide: CACHE_MANAGER,
          useValue: {get: () => null, set: () => jest.fn()}
        }
      ]
    })
      .overrideProvider(DbService)
      .useValue(mockDb)
      .overrideProvider(UserService)
      .useValue(mockUser)
      .compile()

    controller = module.get<WorldController>(WorldController)

    const mockUserWithNullId = {
      getUserFromCookie: () => new User({id: null})
    }
    const offlineModule: TestingModule = await Test.createTestingModule({
      imports: [UserModule],
      controllers: [WorldController],
      providers: [
        WorldService,
        DbService,
        {
          provide: CACHE_MANAGER,
          useValue: {get: () => null, set: () => jest.fn()}
        }
      ]
    })
      .overrideProvider(UserService)
      .useValue(mockUserWithNullId)
      .compile()

    offlineController = offlineModule.get<WorldController>(WorldController)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })

  describe('worldList', () => {
    it('should return world list', async () => {
      expect(await controller.worldList()).toStrictEqual([
        {id: 1, name: 'Lemuria', users: 1}
      ])
    })
  })

  describe('worldGet', () => {
    it('should return none', async () => {
      const statusResponseMock = {
        send: jest.fn((x) => x)
      }
      const responseMock = {
        status: jest.fn().mockReturnValue(statusResponseMock),
        send: jest.fn((x) => x)
      } as unknown as FastifyReply
      expect(
        await offlineController.worldGet('cookie', '1', responseMock)
      ).toStrictEqual(undefined)
      expect(responseMock.status).toHaveBeenCalledWith(401)
    })
    it('should return world 1', async () => {
      const statusResponseMock = {
        send: jest.fn((x) => x)
      }
      const responseMock = {
        status: jest.fn().mockReturnValue(statusResponseMock),
        send: jest.fn((x) => x)
      } as unknown as FastifyReply
      expect(
        await controller.worldGet('cookie', '1', responseMock)
      ).toStrictEqual({
        entry: '0N 0W',
        id: 1,
        name: 'Lemuria',
        welcome: 'Bienvenue sur Lemuria',
        elev: expect.any(Object),
        sky_color: {
          top: [0, 0, 0],
          north: [0, 0, 0],
          east: [0, 0, 0],
          south: [0, 0, 0],
          west: [0, 0, 0],
          bottom: [0, 0, 0]
        },
        terrain: false,
        light_dir: [-0.8, -0.5, -0.2],
        fog: true,
        fog_color: [0, 0, 127],
        fog_max: 120,
        fog_min: 0,
        amblight_color: [255, 255, 255],
        dirlight_color: [255, 255, 255],
        terrain_ambient: 0.2,
        terrain_diffuse: 1,
        terrain_offset: 0
      })
    })
  })

  describe('worldProps', () => {
    it('should return world 1 props in range', async () => {
      expect(
        await controller.worldProps('1', {
          min_x: '0',
          max_x: '0',
          min_y: '0',
          max_y: '0',
          min_z: '0',
          max_z: '0'
        })
      ).toStrictEqual({
        entries: [[0, 'tracteur1', 0, 0, 0, 0, 0, 0, null, null]]
      })
    })

    it('should return all world 1 props', async () => {
      expect(await controller.worldProps('1', {})).toStrictEqual({
        entries: [[0, 'tracteur1', 0, 0, 0, 0, 0, 0, null, null]]
      })
    })
  })
})
