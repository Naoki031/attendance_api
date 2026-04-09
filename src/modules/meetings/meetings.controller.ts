import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  ClassSerializerInterceptor,
} from '@nestjs/common'
import { MeetingsService } from './meetings.service'
import { SpeechService } from './speech.service'
import { CreateMeetingDto } from './dto/create-meeting.dto'
import { UpdateMeetingDto } from './dto/update-meeting.dto'
import { FilterMeetingDto } from './dto/filter-meeting.dto'
import { User as UserDecorator } from '@/modules/auth/decorators/user.decorator'
import type { User } from '@/modules/users/entities/user.entity'

@Controller('meetings')
@UseInterceptors(ClassSerializerInterceptor)
export class MeetingsController {
  constructor(
    private readonly meetingsService: MeetingsService,
    private readonly speechService: SpeechService,
  ) {}

  @Post()
  create(@UserDecorator() user: User, @Body() dto: CreateMeetingDto) {
    return this.meetingsService.create(user.id, dto)
  }

  @Get()
  findAll(@Query() filter: FilterMeetingDto) {
    return this.meetingsService.findAll(filter)
  }

  @Get(':uuid')
  findOne(@Param('uuid') uuid: string) {
    return this.meetingsService.findByUuid(uuid)
  }

  @Patch(':uuid')
  update(@Param('uuid') uuid: string, @UserDecorator() user: User, @Body() dto: UpdateMeetingDto) {
    return this.meetingsService.update(uuid, user.id, dto)
  }

  @Delete(':uuid')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('uuid') uuid: string, @UserDecorator() user: User) {
    return this.meetingsService.remove(uuid, user.id)
  }

  @Post(':uuid/token')
  async getToken(
    @Param('uuid') uuid: string,
    @UserDecorator() user: User,
    @Body() body: { password?: string },
  ) {
    const token = await this.meetingsService.generateToken(
      uuid,
      user.id,
      user.full_name,
      body.password,
    )

    return { token }
  }

  @Post(':uuid/generate-password')
  generatePassword(@Param('uuid') uuid: string, @UserDecorator() user: User) {
    return this.meetingsService.generatePassword(uuid, user.id)
  }

  @Post(':uuid/speech')
  async processSpeech(
    @Param('uuid') uuid: string,
    @UserDecorator() user: User,
    @Body() body: { audioBase64: string; targetLanguages?: string[] },
  ) {
    const meeting = await this.meetingsService.findByUuid(uuid)
    const audioBuffer = Buffer.from(body.audioBase64, 'base64')
    const targetLanguages = body.targetLanguages ?? ['vi', 'en', 'ja']

    return this.speechService.process(audioBuffer, meeting.id, user.id, targetLanguages)
  }
}
