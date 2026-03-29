import { Injectable, NotFoundException, ConflictException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Group } from './entities/group.entity'
import { UserGroup } from './entities/user_group.entity'
import { CreateGroupDto } from './dto/create-group.dto'
import { UpdateGroupDto } from './dto/update-group.dto'
import { CreateUserGroupDto } from './dto/create-user-group.dto'

@Injectable()
export class GroupsService {
  constructor(
    @InjectRepository(Group)
    private readonly groupRepository: Repository<Group>,
    @InjectRepository(UserGroup)
    private readonly userGroupRepository: Repository<UserGroup>,
  ) {}

  /**
   * Creates a new group.
   */
  async create(createGroupDto: CreateGroupDto): Promise<Group> {
    return this.groupRepository.save(createGroupDto)
  }

  /**
   * Retrieves all groups with member count.
   */
  async findAll(): Promise<Group[]> {
    return this.groupRepository.find()
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
    await this.groupRepository.update({ id: groupId }, { ...updateGroupDto })

    return this.findOne(groupId)
  }

  /**
   * Removes a group by ID.
   */
  async remove(groupId: number) {
    return this.groupRepository.delete({ id: groupId })
  }

  /**
   * Retrieves all members of a group with user relation.
   */
  async findMembers(groupId: number): Promise<UserGroup[]> {
    return this.userGroupRepository.find({
      where: { group_id: groupId },
      relations: ['user'],
    })
  }

  /**
   * Adds a user to a group.
   * Throws ConflictException if the user is already a member.
   */
  async addMember(groupId: number, createUserGroupDto: CreateUserGroupDto): Promise<UserGroup> {
    const existing = await this.userGroupRepository.findOne({
      where: { group_id: groupId, user_id: createUserGroupDto.user_id },
    })

    if (existing) {
      throw new ConflictException('User is already a member of this group')
    }

    return this.userGroupRepository.save({
      group_id: groupId,
      user_id: createUserGroupDto.user_id,
    })
  }

  /**
   * Removes a user-group membership by membership ID.
   */
  async removeMember(memberId: number) {
    return this.userGroupRepository.delete({ id: memberId })
  }
}
