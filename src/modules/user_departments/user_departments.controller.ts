import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  ParseIntPipe,
  ValidationPipe,
  UseGuards,
  UseInterceptors,
  ClassSerializerInterceptor,
} from '@nestjs/common'
import { UserDepartmentsService } from './user_departments.service'
import { CreateUserDepartmentDto } from './dto/create-user_department.dto'
import { PermissionsGuard } from '@/modules/permissions/guards/permissions.guard'
import { Permissions } from '@/modules/permissions/decorators/permissions.decorator'

@Controller('user-departments')
@UseGuards(PermissionsGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class UserDepartmentsController {
  constructor(private readonly userDepartmentsService: UserDepartmentsService) {}

  @Post()
  @Permissions('create')
  async create(@Body(ValidationPipe) createDto: CreateUserDepartmentDto) {
    try {
      return await this.userDepartmentsService.create(createDto)
    } catch (error) {
      console.error('Error creating user-department assignment:', error)
      throw error
    }
  }

  @Get()
  @Permissions('read')
  findAll() {
    return this.userDepartmentsService.findAll()
  }

  @Get('department/:departmentId')
  @Permissions('read')
  findByDepartment(@Param('departmentId', ParseIntPipe) departmentId: number) {
    return this.userDepartmentsService.findByDepartment(departmentId)
  }

  @Delete(':id')
  @Permissions('delete')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.userDepartmentsService.remove(id)
  }
}
