import { Injectable } from '@nestjs/common';
import { CreateUserGroupPermissionDto } from './dto/create-user_group_permission.dto';
import { UpdateUserGroupPermissionDto } from './dto/update-user_group_permission.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserGroupPermission } from './entities/user_group_permission.entity';

@Injectable()
export class UserGroupPermissionsService {
  constructor(
    @InjectRepository(UserGroupPermission)
    private readonly userGroupPermissionRepository: Repository<UserGroupPermission>,
  ) { }

  async create(createUserGroupPermissionDto: CreateUserGroupPermissionDto) {
    const userGroupPermission = this.userGroupPermissionRepository.create(createUserGroupPermissionDto);
    return await this.userGroupPermissionRepository.save(userGroupPermission);
  }

  async findAll() {
    return await this.userGroupPermissionRepository.find();
  }

  async findOne(id: number) {
    return await this.userGroupPermissionRepository.findOneBy({ id });
  }

  async update(id: number, updateUserGroupPermissionDto: UpdateUserGroupPermissionDto) {
    await this.userGroupPermissionRepository.update(id, updateUserGroupPermissionDto);
    return this.findOne(id);
  }

  async remove(id: number) {
    await this.userGroupPermissionRepository.delete(id);
    return true;
  }

  async getUserPermissions(userId: number): Promise<UserGroupPermission[]> {
    const userGroupPermissions = await this.userGroupPermissionRepository.find({
      where: { user_id: userId },
      relations: ['permission_group'],
    });

    return userGroupPermissions;
  }
}
