import {JwtService} from '@nestjs/jwt'
import {Test, TestingModule} from '@nestjs/testing'
import {UserService} from './user.service'

describe(UserService.name, () => {
  let service: UserService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UserService, JwtService]
    }).compile()

    service = module.get<UserService>(UserService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})
