import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { RoomSection } from './entities/room-section.entity'
import { RoomSectionItem } from './entities/room-section-item.entity'
import { CreateRoomSectionDto } from './dto/create-room-section.dto'
import { UpdateRoomSectionDto } from './dto/update-room-section.dto'
import { AddRoomSectionItemDto } from './dto/add-room-section-item.dto'
import { RemoveRoomSectionItemDto } from './dto/remove-room-section-item.dto'

@Injectable()
export class RoomSectionsService {
  constructor(
    @InjectRepository(RoomSection)
    private readonly sectionRepository: Repository<RoomSection>,

    @InjectRepository(RoomSectionItem)
    private readonly itemRepository: Repository<RoomSectionItem>,
  ) {}

  /**
   * Returns all sections owned by the given user, ordered by position.
   * Each section includes its items (eager-loaded).
   */
  async findAllForUser(userId: number): Promise<RoomSection[]> {
    return this.sectionRepository.find({
      where: { user_id: userId },
      order: { position: 'ASC', created_at: 'ASC' },
    })
  }

  /**
   * Creates a new section for the given user.
   */
  async create(userId: number, createDto: CreateRoomSectionDto): Promise<RoomSection> {
    const maxPosition = await this.sectionRepository
      .createQueryBuilder('section')
      .select('MAX(section.position)', 'max')
      .where('section.user_id = :userId', { userId })
      .getRawOne<{ max: number | null }>()

    const nextPosition = (maxPosition?.max ?? -1) + 1

    const section = this.sectionRepository.create({
      user_id: userId,
      name: createDto.name,
      position: createDto.position ?? nextPosition,
    })

    return this.sectionRepository.save(section)
  }

  /**
   * Updates name or position of a section owned by the given user.
   */
  async update(
    userId: number,
    sectionId: number,
    updateDto: UpdateRoomSectionDto,
  ): Promise<RoomSection> {
    const section = await this.sectionRepository.findOne({ where: { id: sectionId } })
    if (!section) throw new NotFoundException('Section not found')
    if (section.user_id !== userId) throw new ForbiddenException('Not your section')

    if (updateDto.name !== undefined) section.name = updateDto.name
    if (updateDto.position !== undefined) section.position = updateDto.position

    return this.sectionRepository.save(section)
  }

  /**
   * Deletes a section. Items are cascade-deleted.
   */
  async remove(userId: number, sectionId: number): Promise<void> {
    const section = await this.sectionRepository.findOne({ where: { id: sectionId } })
    if (!section) throw new NotFoundException('Section not found')
    if (section.user_id !== userId) throw new ForbiddenException('Not your section')

    await this.sectionRepository.delete({ id: sectionId })
  }

  /**
   * Adds a meeting or chat room to a section.
   * If the resource is already in another section of the same user, it is moved.
   */
  async addItem(
    userId: number,
    sectionId: number,
    addDto: AddRoomSectionItemDto,
  ): Promise<RoomSection> {
    const section = await this.sectionRepository.findOne({ where: { id: sectionId } })
    if (!section) throw new NotFoundException('Section not found')
    if (section.user_id !== userId) throw new ForbiddenException('Not your section')

    // Remove from any existing section of this user first
    const existingItem = await this.itemRepository
      .createQueryBuilder('item')
      .innerJoin('item.section', 'section')
      .where('section.user_id = :userId', { userId })
      .andWhere('item.resource_type = :type', { type: addDto.resource_type })
      .andWhere('item.resource_id = :resourceId', { resourceId: addDto.resource_id })
      .getOne()

    if (existingItem) {
      await this.itemRepository.delete({ id: existingItem.id })
    }

    await this.itemRepository.save(
      this.itemRepository.create({
        section_id: sectionId,
        resource_type: addDto.resource_type,
        resource_id: addDto.resource_id,
      }),
    )

    return this.sectionRepository.findOne({
      where: { id: sectionId },
    }) as Promise<RoomSection>
  }

  /**
   * Removes a resource from a section.
   */
  async removeItem(
    userId: number,
    sectionId: number,
    removeDto: RemoveRoomSectionItemDto,
  ): Promise<void> {
    const section = await this.sectionRepository.findOne({ where: { id: sectionId } })
    if (!section) throw new NotFoundException('Section not found')
    if (section.user_id !== userId) throw new ForbiddenException('Not your section')

    await this.itemRepository.delete({
      section_id: sectionId,
      resource_type: removeDto.resource_type,
      resource_id: removeDto.resource_id,
    })
  }
}
