import { Injectable } from '@nestjs/common'
import { CreateUserGroupPermissionDto } from './dto/create-user_group_permission.dto'
import { UpdateUserGroupPermissionDto } from './dto/update-user_group_permission.dto'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { UserGroupPermission } from './entities/user_group_permission.entity'

@Injectable()
export class UserGroupPermissionsService {
  constructor(
    @InjectRepository(UserGroupPermission)
    private readonly userGroupPermissionRepository: Repository<UserGroupPermission>,
  ) {}

  async create(createUserGroupPermissionDto: CreateUserGroupPermissionDto) {
    const userGroupPermission = this.userGroupPermissionRepository.create(
      createUserGroupPermissionDto,
    )
    return await this.userGroupPermissionRepository.save(userGroupPermission)
  }

  async findAll() {
    return await this.userGroupPermissionRepository.find()
  }

  async findOne(userGroupPermissionId: number) {
    return await this.userGroupPermissionRepository.findOneBy({ id: userGroupPermissionId })
  }

  async update(userGroupPermissionId: number, updateUserGroupPermissionDto: UpdateUserGroupPermissionDto) {
    await this.userGroupPermissionRepository.update(userGroupPermissionId, updateUserGroupPermissionDto)
    return this.findOne(userGroupPermissionId)
  }

  async remove(userGroupPermissionId: number) {
    await this.userGroupPermissionRepository.delete(userGroupPermissionId)
    return true
  }

  async getUserPermissions(userId: number): Promise<UserGroupPermission[]> {
    const userGroupPermissions = await this.userGroupPermissionRepository.find({
      where: { user_id: userId },
      relations: ['permission_group'],
    })

    return userGroupPermissions
  }
}
