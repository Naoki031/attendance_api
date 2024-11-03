import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  ParseIntPipe,
  ValidationPipe,
} from '@nestjs/common';
import { PermissionGroupsService } from './permission_groups.service';
import { CreatePermissionGroupDto } from './dto/create-permission_group.dto';
import { UpdatePermissionGroupDto } from './dto/update-permission_group.dto';

@Controller('permission-groups')
export class PermissionGroupsController {
  constructor(
    private readonly permissionGroupsService: PermissionGroupsService,
  ) {}

  @Post()
  create(
    @Body(ValidationPipe) createPermissionGroupDto: CreatePermissionGroupDto,
  ) {
    try {
      return this.permissionGroupsService.create(createPermissionGroupDto);
    } catch (error) {
      console.log('Error creating permission group:', error);
      throw error;
    }
  }

  @Get()
  findAll() {
    return this.permissionGroupsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.permissionGroupsService.findOne(id);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body(ValidationPipe) updatePermissionGroupDto: UpdatePermissionGroupDto,
  ) {
    try {
      return this.permissionGroupsService.update(id, updatePermissionGroupDto);
    } catch (error) {
      console.log('Error updating permission group:', error);
      throw error;
    }
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.permissionGroupsService.remove(id);
  }
}
