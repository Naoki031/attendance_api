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
} from '@nestjs/common'
import { DepartmentsService } from './departments.service'
import { CreateDepartmentDto } from './dto/create-department.dto'
import { UpdateDepartmentDto } from './dto/update-department.dto'
import { PermissionsGuard } from '@/modules/permissions/guards/permissions.guard'
import { Permissions } from '@/modules/permissions/decorators/permissions.decorator'

@Controller('departments')
@UseGuards(PermissionsGuard)
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Post()
  @Permissions('create')
  async create(@Body(ValidationPipe) createDepartmentDto: CreateDepartmentDto) {
    try {
      return await this.departmentsService.create(createDepartmentDto)
    } catch (error) {
      console.error('Error creating department:', error)
      throw error
    }
  }

  @Get()
  @Permissions('read')
  findAll() {
    return this.departmentsService.findAll()
  }

  @Get(':id')
  @Permissions('read')
  findOne(@Param('id', ParseIntPipe) departmentId: number) {
    return this.departmentsService.findOne(departmentId)
  }

  @Put(':id')
  @Permissions('update')
  update(
    @Param('id', ParseIntPipe) departmentId: number,
    @Body(ValidationPipe) updateDepartmentDto: UpdateDepartmentDto,
  ) {
    return this.departmentsService.update(departmentId, updateDepartmentDto)
  }

  @Delete(':id')
  @Permissions('delete')
  remove(@Param('id', ParseIntPipe) departmentId: number) {
    return this.departmentsService.remove(departmentId)
  }
}
