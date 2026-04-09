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
  ValidationPipe,
} from '@nestjs/common'
import { MeetingsService } from './meetings.service'
import { SpeechService } from './speech.service'
import { CreateMeetingDto } from './dto/create-meeting.dto'
import { UpdateMeetingDto } from './dto/update-meeting.dto'
import { FilterMeetingDto } from './dto/filter-meeting.dto'
import { GetTokenDto } from './dto/get-token.dto'
import { ProcessSpeechDto } from './dto/process-speech.dto'
import { User as UserDecorator } from '@/modules/auth/decorators/user.decorator'
import type { User } from '@/modules/users/entities/user.entity'
import { isPrivilegedUser } from '@/common/utils/is-privileged.utility'

@Controller('meetings')
@UseInterceptors(ClassSerializerInterceptor)
export class MeetingsController {
  constructor(
    private readonly meetingsService: MeetingsService,
    private readonly speechService: SpeechService,
  ) {}

  @Post()
  create(@UserDecorator() user: User, @Body(ValidationPipe) dto: CreateMeetingDto) {
    return this.meetingsService.create(user.id, dto)
  }

  @Get()
  findAll(@Query() filter: FilterMeetingDto, @UserDecorator() user: User) {
    return this.meetingsService.findAll(filter, user.id, user.roles)
  }

  @Post(':uuid/pin')
  @HttpCode(HttpStatus.NO_CONTENT)
  pin(@Param('uuid') uuid: string, @UserDecorator() user: User) {
    return this.meetingsService.pin(uuid, user.id)
  }

  @Delete(':uuid/pin')
  @HttpCode(HttpStatus.NO_CONTENT)
  unpin(@Param('uuid') uuid: string, @UserDecorator() user: User) {
    return this.meetingsService.unpin(uuid, user.id)
  }

  @Get(':uuid')
  findOne(@Param('uuid') uuid: string) {
    return this.meetingsService.findByUuid(uuid)
  }

  @Get(':uuid/users')
  findUsersForMeeting(@Param('uuid') uuid: string) {
    return this.meetingsService.findUsersForMeeting(uuid)
  }

  @Patch(':uuid')
  update(
    @Param('uuid') uuid: string,
    @UserDecorator() user: User,
    @Body(ValidationPipe) dto: UpdateMeetingDto,
  ) {
    return this.meetingsService.update(uuid, user.id, dto, isPrivilegedUser(user.roles))
  }

  @Delete(':uuid')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('uuid') uuid: string, @UserDecorator() user: User) {
    return this.meetingsService.remove(uuid, user.id, user.roles)
  }

  @Post(':uuid/token')
  async getToken(
    @Param('uuid') uuid: string,
    @UserDecorator() user: User,
    @Body(ValidationPipe) dto: GetTokenDto,
  ) {
    const token = await this.meetingsService.generateToken(
      uuid,
      user.id,
      user.full_name,
      dto.password,
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
    @Body(ValidationPipe) dto: ProcessSpeechDto,
  ) {
    const meeting = await this.meetingsService.findByUuid(uuid)
    const audioBuffer = Buffer.from(dto.audioBase64, 'base64')
    const targetLanguages = dto.targetLanguages ?? ['vi', 'en', 'ja']

    return this.speechService.process(audioBuffer, meeting.id, user.id, targetLanguages)
  }
}
