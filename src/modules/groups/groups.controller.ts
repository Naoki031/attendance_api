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
import { GroupsService } from './groups.service'
import { CreateGroupDto } from './dto/create-group.dto'
import { UpdateGroupDto } from './dto/update-group.dto'
import { CreateUserGroupDto } from './dto/create-user-group.dto'
import { PermissionsGuard } from '@/modules/permissions/guards/permissions.guard'
import { Permissions } from '@/modules/permissions/decorators/permissions.decorator'

@Controller('groups')
@UseGuards(PermissionsGuard)
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Post()
  @Permissions('create')
  create(@Body(ValidationPipe) createGroupDto: CreateGroupDto) {
    return this.groupsService.create(createGroupDto)
  }

  @Get()
  @Permissions('read')
  findAll() {
    return this.groupsService.findAll()
  }

  @Get(':id')
  @Permissions('read')
  findOne(@Param('id', ParseIntPipe) groupId: number) {
    return this.groupsService.findOne(groupId)
  }

  @Put(':id')
  @Permissions('update')
  update(
    @Param('id', ParseIntPipe) groupId: number,
    @Body(ValidationPipe) updateGroupDto: UpdateGroupDto,
  ) {
    return this.groupsService.update(groupId, updateGroupDto)
  }

  @Delete(':id')
  @Permissions('delete')
  remove(@Param('id', ParseIntPipe) groupId: number) {
    return this.groupsService.remove(groupId)
  }

  @Get(':id/members')
  @Permissions('read')
  findMembers(@Param('id', ParseIntPipe) groupId: number) {
    return this.groupsService.findMembers(groupId)
  }

  @Post(':id/members')
  @Permissions('update')
  addMember(
    @Param('id', ParseIntPipe) groupId: number,
    @Body(ValidationPipe) createUserGroupDto: CreateUserGroupDto,
  ) {
    return this.groupsService.addMember(groupId, createUserGroupDto)
  }

  @Delete(':id/members/:memberId')
  @Permissions('update')
  removeMember(@Param('memberId', ParseIntPipe) memberId: number) {
    return this.groupsService.removeMember(memberId)
  }
}
