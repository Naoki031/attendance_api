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
  ClassSerializerInterceptor,
  UseInterceptors,
} from '@nestjs/common'
import { SlackChannelsService } from './slack_channels.service'
import { CreateSlackChannelDto } from './dto/create-slack_channel.dto'
import { UpdateSlackChannelDto } from './dto/update-slack_channel.dto'
import { PermissionsGuard } from '@/modules/permissions/guards/permissions.guard'
import { Permissions } from '@/modules/permissions/decorators/permissions.decorator'

@Controller('slack-channels')
@UseGuards(PermissionsGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class SlackChannelsController {
  constructor(private readonly slackChannelsService: SlackChannelsService) {}

  @Post()
  @Permissions('create')
  create(@Body(ValidationPipe) createDto: CreateSlackChannelDto) {
    return this.slackChannelsService.create(createDto)
  }

  @Get()
  @Permissions('read')
  findAll() {
    return this.slackChannelsService.findAll()
  }

  @Get(':id')
  @Permissions('read')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.slackChannelsService.findOne(id)
  }

  @Put(':id')
  @Permissions('update')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body(ValidationPipe) updateDto: UpdateSlackChannelDto,
  ) {
    return this.slackChannelsService.update(id, updateDto)
  }

  @Delete(':id')
  @Permissions('delete')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.slackChannelsService.remove(id)
  }
}
