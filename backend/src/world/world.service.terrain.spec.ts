import {Test, TestingModule} from '@nestjs/testing'
import {WorldService} from './world.service'
import {DbService} from '../db/db.service'
import {CACHE_MANAGER} from '@nestjs/cache-manager'

const mockDbService = {
  elev: {
    findMany: vi.fn()
  },
  prop: {
    findMany: vi.fn()
  },
  world: {
    findMany: vi.fn(),
    findFirst: vi.fn()
  }
}

const mockCache = {
  get: vi.fn(),
  set: vi.fn()
}

describe('WorldService Terrain Logic', () => {
  let service: WorldService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorldService,
        {provide: DbService, useValue: mockDbService},
        {provide: CACHE_MANAGER, useValue: mockCache}
      ]
    }).compile()

    service = module.get<WorldService>(WorldService)
    vi.clearAllMocks()
  })

  it('should process a flat node correctly', async () => {
    mockCache.get.mockResolvedValue(null)
    mockDbService.elev.findMany.mockResolvedValue([
      {
        node_x: 0,
        node_z: 0,
        radius: 4, // width 8
        textures: '5',
        heights: '10'
      }
    ])

    const result = await service.getTerrainPage(1, 0, 0)

    // Check a few cells
    // node_x=0, node_z=0. Cell index = row + j + 0 + 0.
    // row = i * 128.
    // i=0, j=0 => cell 0.
    // i=0, j=7 => cell 7.
    // i=7, j=0 => cell 7*128 = 896.
    expect(result![0]).toEqual([5, 10])
    expect(result![7]).toEqual([5, 10])
    expect(result![896]).toEqual([5, 10])

    // Check total count. 8x8 = 64 cells should be set.
    expect(Object.keys(result!).length).toBe(64)
  })

  it('should process a detailed node correctly', async () => {
    mockCache.get.mockResolvedValue(null)
    // Create a 2x2 node (radius 1)
    // Width = 2.
    // Textures: "1 2 3 4" ->
    // i=0, j=0 (idx 0) -> 1
    // i=0, j=1 (idx 1) -> 2
    // i=1, j=0 (idx 2) -> 3
    // i=1, j=1 (idx 3) -> 4

    mockDbService.elev.findMany.mockResolvedValue([
      {
        node_x: 10,
        node_z: 10,
        radius: 1,
        textures: '1 2 3 4',
        heights: '10 20 30 40'
      }
    ])

    const result = await service.getTerrainPage(1, 0, 0)

    // Offsets: node_x=10, node_z=10 -> zOffset = 1280.
    // i=0, row=0. cell = 0 + 0 + 10 + 1280 = 1290. val: 1, 10
    // i=0, row=0. cell = 0 + 1 + 10 + 1280 = 1291. val: 2, 20
    // i=1, row=128. cell = 128 + 0 + 10 + 1280 = 1418. val: 3, 30
    // i=1, row=128. cell = 128 + 1 + 10 + 1280 = 1419. val: 4, 40

    expect(result![1290]).toEqual([1, 10])
    expect(result![1291]).toEqual([2, 20])
    expect(result![1418]).toEqual([3, 30])
    expect(result![1419]).toEqual([4, 40])
  })

  it('should ignore empty cells (0,0)', async () => {
    mockCache.get.mockResolvedValue(null)
    mockDbService.elev.findMany.mockResolvedValue([
      {
        node_x: 0,
        node_z: 0,
        radius: 1, // width 2
        textures: '0 1 0 1',
        heights: '0 1 0 1'
      }
    ])

    const result = await service.getTerrainPage(1, 0, 0)
    // idx 0: t=0, h=0 -> skip
    // idx 1: t=1, h=1 -> set
    // idx 2: t=0, h=0 -> skip
    // idx 3: t=1, h=1 -> set

    expect(Object.keys(result!).length).toBe(2)
  })

  it('should handle partial arrays by repeating the first element (legacy behavior)', async () => {
    mockCache.get.mockResolvedValue(null)
    mockDbService.elev.findMany.mockResolvedValue([
      {
        node_x: 0,
        node_z: 0,
        radius: 1, // width 2
        textures: '5', // length 1
        heights: '10' // length 1
      }
    ])

    // Even though arrays are length 1, if it wasn't caught by the "flat" optimization (e.g. if one was length 1 and other length 2?),
    // the logic falls back to checking length.
    // But here textures='5' -> length 1.
    // Wait, if textures='5', heights='10', it hits the flat path.

    // Let's try mixed case: textures='5', heights='10 20'.
    // This won't hit the flat path (both must be len 1).
    // Logic: idx < tLen ? textures[idx] : textures[0]

    mockDbService.elev.findMany.mockResolvedValue([
      {
        node_x: 0,
        node_z: 0,
        radius: 1, // width 2
        textures: '5',
        heights: '10 20'
      }
    ])

    const result = await service.getTerrainPage(1, 0, 0)

    // i=0, j=0. idx=0. t=5, h=10.
    // i=0, j=1. idx=1. t=5 (fallback), h=20.
    // i=1, j=0. idx=2. t=5, h=10 (fallback? no, heights has only 2 elements? Wait).
    // heights='10 20' -> [10, 20]. Len 2.
    // idx 2. 2 < 2 is False. So heights[0] -> 10.
    // idx 3. 3 < 2 is False. So heights[0] -> 10.

    // cell 0: [5, 10]
    // cell 1: [5, 20]
    // cell 128: [5, 10]
    // cell 129: [5, 10]

    expect(result![0]).toEqual([5, 10])
    expect(result![1]).toEqual([5, 20])
    expect(result![128]).toEqual([5, 10])
    expect(result![129]).toEqual([5, 10])
  })
})
