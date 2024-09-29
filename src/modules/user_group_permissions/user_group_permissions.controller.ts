import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { UserGroupPermissionsService } from './user_group_permissions.service';
import { CreateUserGroupPermissionDto } from './dto/create-user_group_permission.dto';
import { UpdateUserGroupPermissionDto } from './dto/update-user_group_permission.dto';

@Controller('user-group-permissions')
export class UserGroupPermissionsController {
  constructor(private readonly userGroupPermissionsService: UserGroupPermissionsService) {}

  @Post()
  create(@Body() createUserGroupPermissionDto: CreateUserGroupPermissionDto) {
    return this.userGroupPermissionsService.create(createUserGroupPermissionDto);
  }

  @Get()
  findAll() {
    return this.userGroupPermissionsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.userGroupPermissionsService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserGroupPermissionDto: UpdateUserGroupPermissionDto) {
    return this.userGroupPermissionsService.update(+id, updateUserGroupPermissionDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.userGroupPermissionsService.remove(+id);
  }
}
