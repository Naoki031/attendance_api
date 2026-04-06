import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  Query,
  ParseIntPipe,
  ValidationPipe,
  UseGuards,
} from '@nestjs/common'
import { PermissionGroupsService } from './permission_groups.service'
import { CreatePermissionGroupDto } from './dto/create-permission_group.dto'
import { UpdatePermissionGroupDto } from './dto/update-permission_group.dto'
import { PermissionsGuard } from '@/modules/permissions/guards/permissions.guard'
import { Permissions } from '@/modules/permissions/decorators/permissions.decorator'

@Controller('permission-groups')
@UseGuards(PermissionsGuard)
export class PermissionGroupsController {
  constructor(private readonly permissionGroupsService: PermissionGroupsService) {}

  @Post()
  create(@Body(ValidationPipe) createPermissionGroupDto: CreatePermissionGroupDto) {
    return this.permissionGroupsService.create(createPermissionGroupDto)
  }

  @Get()
  @Permissions('all_privileges', 'read')
  findAll(@Query('search') search?: string) {
    if (search) {
      return this.permissionGroupsService.findWithFilters({ search })
    }

    return this.permissionGroupsService.findAll()
  }

  @Permissions('all_privileges', 'read')
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) permissionGroupId: number) {
    return this.permissionGroupsService.findOne(permissionGroupId)
  }

  @Put(':id')
  @Permissions('update')
  update(
    @Param('id', ParseIntPipe) permissionGroupId: number,
    @Body(ValidationPipe) updatePermissionGroupDto: UpdatePermissionGroupDto,
  ) {
    return this.permissionGroupsService.update(permissionGroupId, updatePermissionGroupDto)
  }

  @Delete(':id')
  @Permissions('delete')
  remove(@Param('id', ParseIntPipe) permissionGroupId: number) {
    return this.permissionGroupsService.remove(permissionGroupId)
  }
}
