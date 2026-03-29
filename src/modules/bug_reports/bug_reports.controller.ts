import { Controller, Get, Post, Put, Param, Body, ValidationPipe, UseGuards } from '@nestjs/common'
import { BugReportsService } from './bug_reports.service'
import { CreateBugReportDto } from './dto/create-bug_report.dto'
import { UpdateBugReportDto } from './dto/update-bug_report.dto'
import { PermissionsGuard } from '@/modules/permissions/guards/permissions.guard'
import { Permissions } from '@/modules/permissions/decorators/permissions.decorator'
import { User } from '@/modules/auth/decorators/user.decorator'
import { User as UserEntity } from '@/modules/users/entities/user.entity'

@Controller('bug-reports')
@UseGuards(PermissionsGuard)
export class BugReportsController {
  constructor(private readonly bugReportsService: BugReportsService) {}

  @Post()
  async create(
    @Body(ValidationPipe) createDto: CreateBugReportDto,
    @User() requestingUser: UserEntity,
  ) {
    return this.bugReportsService.create(createDto, requestingUser)
  }

  @Get('mine')
  async findMine(@User() requestingUser: UserEntity) {
    return this.bugReportsService.findByUser(requestingUser.id)
  }

  @Get()
  @Permissions('read')
  findAll() {
    return this.bugReportsService.findAll()
  }

  @Get(':id')
  @Permissions('read')
  findOne(@Param('id') id: string) {
    return this.bugReportsService.findOne(+id)
  }

  @Put(':id')
  @Permissions('update')
  update(@Param('id') id: string, @Body(ValidationPipe) updateDto: UpdateBugReportDto) {
    return this.bugReportsService.update(+id, updateDto)
  }
}
