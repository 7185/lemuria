import {DbService} from './../db/db.service'
import {Test, TestingModule} from '@nestjs/testing'
import {WorldController} from './world.controller'
import {WorldService} from './world.service'

describe('WorldController', () => {
  let controller: WorldController

  beforeEach(async () => {
    const mockDb = {
      world: {
        findFirst: () =>
          Promise.resolve({
            id: 1,
            name: 'Lemuria',
            data: '{"welcome": "Bienvenue sur Lemuria"}'
          }),
        findMany: () => Promise.resolve([{id: 1, name: 'Lemuria', data: '{}'}])
      },
      prop: {
        findMany: () =>
          Promise.resolve([[0, 'tracteur1', 0, 0, 0, 0, 0, 0, null, null]])
      }
    }
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorldController],
      providers: [WorldService, DbService]
    })
      .overrideProvider(DbService)
      .useValue(mockDb)
      .compile()

    controller = module.get<WorldController>(WorldController)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })

  describe('worldList', () => {
    it('should return world list', async () => {
      expect(await controller.worldList()).toStrictEqual([
        {id: 1, name: 'Lemuria', users: 0}
      ])
    })
  })

  describe('worldGet', () => {
    it('should return world 1', async () => {
      expect(await controller.worldGet('1')).toStrictEqual({
        entry: '0N 0W',
        id: 1,
        name: 'Lemuria',
        welcome: 'Bienvenue sur Lemuria',
        elev: undefined,
        path: undefined,
        sky_color: {
          top: [0, 0, 0],
          north: [0, 0, 0],
          east: [0, 0, 0],
          south: [0, 0, 0],
          west: [0, 0, 0],
          bottom: [0, 0, 0]
        },
        skybox: undefined,
        terrain: false
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
