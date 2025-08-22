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
  UseGuards,
} from '@nestjs/common';
import { PermissionsService } from './permissions.service';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { PermissionsGuard } from '@/modules/permissions/guards/permissions.guard';
import { Permissions } from '@/modules/permissions/decorators/permissions.decorator';

@Controller('permissions')
@UseGuards(PermissionsGuard)
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Post()
  @Permissions('create')
  create(@Body(ValidationPipe) createPermissionDto: CreatePermissionDto) {
    try {
      return this.permissionsService.create(createPermissionDto);
    } catch (error) {
      console.error('Error creating permission:', error);

      throw error;
    }
  }

  @Get()
  @Permissions('read')
  findAll() {
    return this.permissionsService.findAll();
  }

  @Get(':id')
  @Permissions('read')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.permissionsService.findOne(id);
  }

  @Put(':id')
  @Permissions('update')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePermissionDto: UpdatePermissionDto,
  ) {
    try {
      return this.permissionsService.update(id, updatePermissionDto);
    } catch (error) {
      console.error('Error updating role:', error);

      throw error;
    }
  }

  @Delete(':id')
  @Permissions('delete')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.permissionsService.remove(id);
  }
}
