import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Group } from './entities/group.entity'
import { UserGroup } from './entities/user_group.entity'
import { CreateGroupDto } from './dto/create-group.dto'
import { UpdateGroupDto } from './dto/update-group.dto'
import { CreateUserGroupDto } from './dto/create-user-group.dto'
import { ErrorLogsService } from '@/modules/error_logs/error_logs.service'

@Injectable()
export class GroupsService {
  private readonly logger = new Logger(GroupsService.name)

  constructor(
    @InjectRepository(Group)
    private readonly groupRepository: Repository<Group>,
    @InjectRepository(UserGroup)
    private readonly userGroupRepository: Repository<UserGroup>,
    private readonly errorLogsService: ErrorLogsService,
  ) {}

  /**
   * Creates a new group.
   */
  async create(createGroupDto: CreateGroupDto): Promise<Group> {
    try {
      return await this.groupRepository.save(createGroupDto)
    } catch (error) {
      this.logger.error('Failed to create group', error)
      this.errorLogsService.logError({
        message: 'Failed to create group',
        stackTrace: (error as Error).stack ?? null,
        path: 'groups',
      })
      throw error
    }
  }

  /**
   * Retrieves all groups with member count.
   */
  async findAll() {
    try {
      const groups = await this.groupRepository.find()

      if (groups.length === 0) return groups

      const groupIds = groups.map((group) => group.id)
      const countRows: { group_id: number; count: string }[] = await this.userGroupRepository.query(
        `SELECT group_id, COUNT(*) as count FROM user_groups WHERE group_id IN (${groupIds.map(() => '?').join(',')}) GROUP BY group_id`,
        groupIds,
      )

      const countMap = new Map(countRows.map((row) => [Number(row.group_id), Number(row.count)]))

      return groups.map((group) => ({ ...group, member_count: countMap.get(group.id) ?? 0 }))
    } catch (error) {
      this.logger.error('Failed to fetch all groups', error)
      this.errorLogsService.logError({
        message: 'Failed to fetch all groups',
        stackTrace: (error as Error).stack ?? null,
        path: 'groups',
      })
      throw error
    }
  }

  /**
   * Retrieves a single group by ID.
   */
  async findOne(groupId: number): Promise<Group> {
    const group = await this.groupRepository.findOne({ where: { id: groupId } })

    if (!group) {
      throw new NotFoundException('Group not found')
    }

    return group
  }

  /**
   * Updates a group by ID.
   */
  async update(groupId: number, updateGroupDto: UpdateGroupDto): Promise<Group> {
    try {
      await this.groupRepository.update({ id: groupId }, { ...updateGroupDto })

      return this.findOne(groupId)
    } catch (error) {
      this.logger.error('Failed to update group', error)
      this.errorLogsService.logError({
        message: 'Failed to update group',
        stackTrace: (error as Error).stack ?? null,
        path: 'groups',
      })
      throw error
    }
  }

  /**
   * Removes a group by ID.
   */
  async remove(groupId: number) {
    try {
      return await this.groupRepository.delete({ id: groupId })
    } catch (error) {
      this.logger.error('Failed to remove group', error)
      this.errorLogsService.logError({
        message: 'Failed to remove group',
        stackTrace: (error as Error).stack ?? null,
        path: 'groups',
      })
      throw error
    }
  }

  /**
   * Retrieves all members of a group with user relation.
   */
  async findMembers(groupId: number): Promise<UserGroup[]> {
    try {
      return await this.userGroupRepository.find({
        where: { group_id: groupId },
        relations: ['user'],
      })
    } catch (error) {
      this.logger.error('Failed to fetch group members', error)
      this.errorLogsService.logError({
        message: 'Failed to fetch group members',
        stackTrace: (error as Error).stack ?? null,
        path: 'groups',
      })
      throw error
    }
  }

  /**
   * Adds a user to a group.
   * Throws ConflictException if the user is already a member.
   */
  async addMember(groupId: number, createUserGroupDto: CreateUserGroupDto): Promise<UserGroup> {
    try {
      const existing = await this.userGroupRepository.findOne({
        where: { group_id: groupId, user_id: createUserGroupDto.user_id },
      })

      if (existing) {
        throw new ConflictException('User is already a member of this group')
      }

      return await this.userGroupRepository.save({
        group_id: groupId,
        user_id: createUserGroupDto.user_id,
      })
    } catch (error) {
      this.logger.error('Failed to add group member', error)
      this.errorLogsService.logError({
        message: 'Failed to add group member',
        stackTrace: (error as Error).stack ?? null,
        path: 'groups',
      })
      throw error
    }
  }

  /**
   * Removes a user-group membership by membership ID.
   */
  async removeMember(memberId: number) {
    try {
      return await this.userGroupRepository.delete({ id: memberId })
    } catch (error) {
      this.logger.error('Failed to remove group member', error)
      this.errorLogsService.logError({
        message: 'Failed to remove group member',
        stackTrace: (error as Error).stack ?? null,
        path: 'groups',
      })
      throw error
    }
  }
}
