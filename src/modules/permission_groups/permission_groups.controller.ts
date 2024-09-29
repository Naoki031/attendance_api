import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { PermissionGroupsService } from './permission_groups.service';
import { CreatePermissionGroupDto } from './dto/create-permission_group.dto';
import { UpdatePermissionGroupDto } from './dto/update-permission_group.dto';

@Controller('permission-groups')
export class PermissionGroupsController {
  constructor(private readonly permissionGroupsService: PermissionGroupsService) {}

  @Post()
  create(@Body() createPermissionGroupDto: CreatePermissionGroupDto) {
    return this.permissionGroupsService.create(createPermissionGroupDto);
  }

  @Get()
  findAll() {
    return this.permissionGroupsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.permissionGroupsService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updatePermissionGroupDto: UpdatePermissionGroupDto) {
    return this.permissionGroupsService.update(+id, updatePermissionGroupDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.permissionGroupsService.remove(+id);
  }
}
