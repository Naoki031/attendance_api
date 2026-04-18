import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, ValidationPipe, ForbiddenException } from '@nestjs/common'
import request from 'supertest'
import { MemoriesController } from './memories.controller'
import { MemoriesService } from './memories.service'
import { PermissionsGuard } from '@/modules/permissions/guards/permissions.guard'
import { EventType, Privacy } from './entities/memory_album.entity'

const mockMemoriesService = {
  findAll: jest.fn(),
  create: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  uploadPhotos: jest.fn(),
  removePhoto: jest.fn(),
  getReactions: jest.fn(),
  toggleReaction: jest.fn(),
  getComments: jest.fn(),
  addComment: jest.fn(),
  removeComment: jest.fn(),
  shareToChat: jest.fn(),
}

const mockUser = { id: 1, email: 'test@example.com' }

describe('MemoriesController', () => {
  let app: INestApplication

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MemoriesController],
      providers: [{ provide: MemoriesService, useValue: mockMemoriesService }],
    })
      .overrideGuard(PermissionsGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp: () => { getRequest: () => { user: typeof mockUser } }
        }) => {
          context.switchToHttp().getRequest().user = mockUser
          return true
        },
      })
      .compile()

    app = module.createNestApplication()
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
    await app.init()
  })

  afterEach(async () => {
    await app.close()
    jest.clearAllMocks()
  })

  describe('GET /memories/albums', () => {
    it('returns 200 with { success: true, data }', async () => {
      const fakeResult = { items: [], total: 0, page: 1, limit: 20 }
      mockMemoriesService.findAll.mockResolvedValue(fakeResult)

      const response = await request(app.getHttpServer()).get('/memories/albums').expect(200)

      expect(response.body).toEqual({ success: true, data: fakeResult })
      expect(mockMemoriesService.findAll).toHaveBeenCalledWith(mockUser.id, expect.any(Object))
    })
  })

  describe('POST /memories/albums', () => {
    it('returns 400 when body is empty', async () => {
      await request(app.getHttpServer()).post('/memories/albums').send({}).expect(400)

      expect(mockMemoriesService.create).not.toHaveBeenCalled()
    })

    it('returns 201 with { success: true, data } when body is valid', async () => {
      const validDto = {
        title: 'Team Building 2025',
        eventType: EventType.TEAM_BUILDING,
        date: '2025-06-01',
        privacy: Privacy.PUBLIC,
      }
      const fakeAlbum = { id: 'uuid-1', ...validDto, createdById: mockUser.id }
      mockMemoriesService.create.mockResolvedValue(fakeAlbum)

      const response = await request(app.getHttpServer())
        .post('/memories/albums')
        .send(validDto)
        .expect(201)

      expect(response.body).toEqual({ success: true, data: fakeAlbum })
    })
  })

  describe('DELETE /memories/albums/:id', () => {
    it('returns 403 when service throws ForbiddenException', async () => {
      mockMemoriesService.remove.mockRejectedValue(
        new ForbiddenException('Only the album creator can delete this album'),
      )

      await request(app.getHttpServer()).delete('/memories/albums/some-album-id').expect(403)
    })
  })
})
