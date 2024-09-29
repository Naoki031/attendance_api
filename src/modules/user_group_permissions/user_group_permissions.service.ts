import { Injectable } from '@nestjs/common';
import { CreateUserGroupPermissionDto } from './dto/create-user_group_permission.dto';
import { UpdateUserGroupPermissionDto } from './dto/update-user_group_permission.dto';

@Injectable()
export class UserGroupPermissionsService {
  create(createUserGroupPermissionDto: CreateUserGroupPermissionDto) {
    return 'This action adds a new userGroupPermission';
  }

  findAll() {
    return `This action returns all userGroupPermissions`;
  }

  findOne(id: number) {
    return `This action returns a #${id} userGroupPermission`;
  }

  update(id: number, updateUserGroupPermissionDto: UpdateUserGroupPermissionDto) {
    return `This action updates a #${id} userGroupPermission`;
  }

  remove(id: number) {
    return `This action removes a #${id} userGroupPermission`;
  }
}
