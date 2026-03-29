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
import { RolesService } from './roles.service'
import { CreateRoleDto } from './dto/create-role.dto'
import { UpdateRoleDto } from './dto/update-role.dto'
import { PermissionsGuard } from '@/modules/permissions/guards/permissions.guard'
import { Permissions } from '@/modules/permissions/decorators/permissions.decorator'

@Controller('roles')
@UseGuards(PermissionsGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  @Permissions('create')
  async create(@Body(ValidationPipe) createRoleDto: CreateRoleDto) {
    try {
      return await this.rolesService.create(createRoleDto)
    } catch (error) {
      console.error('Error creating role:', error)

      throw error
    }
  }

  @Get()
  @Permissions('read')
  findAll(@Query('search') search?: string) {
    if (search) {
      return this.rolesService.findWithFilters({ search })
    }

    return this.rolesService.findAll()
  }

  @Get(':id')
  @Permissions('read')
  findOne(@Param('id', ParseIntPipe) roleId: string) {
    return this.rolesService.findOne(+roleId)
  }

  @Put(':id')
  @Permissions('update')
  async update(
    @Param('id', ParseIntPipe) roleId: number,
    @Body(ValidationPipe) updateRoleDto: UpdateRoleDto,
  ) {
    try {
      return await this.rolesService.update(+roleId, updateRoleDto)
    } catch (error) {
      console.error('Error updating role:', error)

      throw error
    }
  }

  @Delete(':id')
  @Permissions('delete')
  remove(@Param('id', ParseIntPipe) roleId: number) {
    return this.rolesService.remove(+roleId)
  }
}
