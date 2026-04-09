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
import { PermissionsService } from './permissions.service'
import { CreatePermissionDto } from './dto/create-permission.dto'
import { UpdatePermissionDto } from './dto/update-permission.dto'
import { PermissionsGuard } from '@/modules/permissions/guards/permissions.guard'
import { Permissions } from '@/modules/permissions/decorators/permissions.decorator'

@Controller('permissions')
@UseGuards(PermissionsGuard)
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Post()
  @Permissions('all_privileges', 'create')
  create(@Body(ValidationPipe) createPermissionDto: CreatePermissionDto) {
    return this.permissionsService.create(createPermissionDto)
  }

  @Get()
  @Permissions('all_privileges', 'read')
  findAll(@Query('search') search?: string) {
    if (search) {
      return this.permissionsService.findWithFilters({ search })
    }

    return this.permissionsService.findAll()
  }

  @Get(':id')
  @Permissions('all_privileges', 'read')
  findOne(@Param('id', ParseIntPipe) permissionId: number) {
    return this.permissionsService.findOne(permissionId)
  }

  @Put(':id')
  @Permissions('all_privileges', 'update')
  update(
    @Param('id', ParseIntPipe) permissionId: number,
    @Body(ValidationPipe) updatePermissionDto: UpdatePermissionDto,
  ) {
    return this.permissionsService.update(permissionId, updatePermissionDto)
  }

  @Delete(':id')
  @Permissions('all_privileges', 'delete')
  remove(@Param('id', ParseIntPipe) permissionId: number) {
    return this.permissionsService.remove(permissionId)
  }
}
