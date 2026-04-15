import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Patch,
  Param,
  Query,
  ParseIntPipe,
  ValidationPipe,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { ClassSerializerInterceptor } from '@nestjs/common'
import { EmployeeRequestsService } from './employee_requests.service'
import { CreateEmployeeRequestDto } from './dto/create-employee_request.dto'
import { UpdateEmployeeRequestDto } from './dto/update-employee_request.dto'
import { ApproveEmployeeRequestDto } from './dto/approve-employee_request.dto'
import { FilterEmployeeRequestDto } from './dto/filter-employee_request.dto'
import { PermissionsGuard } from '@/modules/permissions/guards/permissions.guard'
import { Permissions } from '@/modules/permissions/decorators/permissions.decorator'
import { User } from '@/modules/auth/decorators/user.decorator'
import { User as UserEntity } from '@/modules/users/entities/user.entity'

@Controller('employee-requests')
@UseGuards(PermissionsGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class EmployeeRequestsController {
  constructor(private readonly employeeRequestsService: EmployeeRequestsService) {}

  @Post()
  @Permissions('all_privileges', 'create')
  create(
    @Body(ValidationPipe) createDto: CreateEmployeeRequestDto,
    @User() requestingUser: UserEntity,
  ) {
    return this.employeeRequestsService.create(createDto, requestingUser)
  }

  @Get()
  @Permissions('all_privileges', 'read')
  findAll(
    @Query(ValidationPipe) filterDto: FilterEmployeeRequestDto,
    @User() requestingUser: UserEntity,
  ) {
    return this.employeeRequestsService.findAll(requestingUser.id, filterDto)
  }

  @Get('approved')
  findAllApproved(@User() requestingUser: UserEntity) {
    return this.employeeRequestsService.findAllApproved(requestingUser.id)
  }

  @Get('calendar')
  findAllForCalendar(@User() requestingUser: UserEntity) {
    return this.employeeRequestsService.findAllForCalendar(requestingUser.id)
  }

  @Get('pending-count')
  @Permissions('all_privileges', 'read')
  getPendingCount(@User() requestingUser: UserEntity) {
    return this.employeeRequestsService.getPendingCount(requestingUser.id)
  }

  @Get('can-approve')
  @Permissions('all_privileges', 'read')
  async canApprove(@User() requestingUser: UserEntity) {
    const canApprove = await this.employeeRequestsService.isCompanyApprover(requestingUser.id)
    return { canApprove }
  }

  @Get('my')
  findMine(
    @User() requestingUser: UserEntity,
    @Query(ValidationPipe) filterDto: FilterEmployeeRequestDto,
  ) {
    return this.employeeRequestsService.findByUser(requestingUser.id, filterDto.status)
  }

  @Get(':id')
  @Permissions('all_privileges', 'read')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.employeeRequestsService.findOne(id)
  }

  @Patch(':id')
  updateRequest(
    @Param('id', ParseIntPipe) id: number,
    @Body(ValidationPipe) updateDto: UpdateEmployeeRequestDto,
    @User() requestingUser: UserEntity,
  ) {
    return this.employeeRequestsService.update(id, updateDto, requestingUser)
  }

  @Put(':id/approve')
  @Permissions('all_privileges', 'update')
  approve(
    @Param('id', ParseIntPipe) id: number,
    @Body(ValidationPipe) approveDto: ApproveEmployeeRequestDto,
    @User() approvingUser: UserEntity,
  ) {
    return this.employeeRequestsService.approve(id, approveDto, approvingUser)
  }
}
