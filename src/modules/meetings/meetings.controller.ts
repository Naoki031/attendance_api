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
  UseGuards,
  ClassSerializerInterceptor,
  ValidationPipe,
  ParseIntPipe,
} from '@nestjs/common'
import { MeetingsService } from './meetings.service'
import { MeetingsGateway } from './meetings.gateway'
import { SpeechService } from './speech.service'
import { CreateMeetingDto } from './dto/create-meeting.dto'
import { UpdateMeetingDto } from './dto/update-meeting.dto'
import { FilterMeetingDto } from './dto/filter-meeting.dto'
import { GetTokenDto } from './dto/get-token.dto'
import { ProcessSpeechDto } from './dto/process-speech.dto'
import { CreateInvitesDto } from './dto/create-invites.dto'
import { RsvpDto } from './dto/rsvp.dto'
import { ChatRoomService } from '@/modules/chat/chat-room.service'
import { User as UserDecorator } from '@/modules/auth/decorators/user.decorator'
import type { User } from '@/modules/users/entities/user.entity'
import { isPrivilegedUser } from '@/common/utils/is-privileged.utility'
import { PermissionsGuard } from '@/modules/permissions/guards/permissions.guard'
import { Permissions } from '@/modules/permissions/decorators/permissions.decorator'

@Controller('meetings')
@UseGuards(PermissionsGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class MeetingsController {
  constructor(
    private readonly meetingsService: MeetingsService,
    private readonly meetingsGateway: MeetingsGateway,
    private readonly speechService: SpeechService,
    private readonly chatRoomService: ChatRoomService,
  ) {}

  @Post()
  @Permissions('all_privileges', 'create')
  create(@UserDecorator() user: User, @Body(ValidationPipe) dto: CreateMeetingDto) {
    return this.meetingsService.create(user.id, dto)
  }

  @Get()
  @Permissions('all_privileges', 'read')
  findAll(@Query() filter: FilterMeetingDto, @UserDecorator() user: User) {
    return this.meetingsService.findAll(filter, user.id, user.roles)
  }

  @Post(':uuid/pin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions('all_privileges', 'update')
  pin(@Param('uuid') uuid: string, @UserDecorator() user: User) {
    return this.meetingsService.pin(uuid, user.id)
  }

  @Delete(':uuid/pin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions('all_privileges', 'update')
  unpin(@Param('uuid') uuid: string, @UserDecorator() user: User) {
    return this.meetingsService.unpin(uuid, user.id)
  }

  @Get(':uuid')
  @Permissions('all_privileges', 'read')
  findOne(@Param('uuid') uuid: string) {
    return this.meetingsService.findByUuid(uuid)
  }

  @Get(':uuid/users')
  @Permissions('all_privileges', 'read')
  findUsersForMeeting(@Param('uuid') uuid: string) {
    return this.meetingsService.findUsersForMeeting(uuid)
  }

  @Patch(':uuid')
  @Permissions('all_privileges', 'update')
  update(
    @Param('uuid') uuid: string,
    @UserDecorator() user: User,
    @Body(ValidationPipe) dto: UpdateMeetingDto,
  ) {
    return this.meetingsService.update(uuid, user.id, dto, isPrivilegedUser(user.roles))
  }

  @Delete(':uuid')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions('all_privileges', 'delete')
  remove(@Param('uuid') uuid: string, @UserDecorator() user: User) {
    return this.meetingsService.remove(uuid, user.id, user.roles)
  }

  @Post(':uuid/token')
  @Permissions('all_privileges', 'read')
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

  /**
   * Returns the dedicated chat room UUID for a meeting.
   * Creates the room on first access and auto-adds the requesting user as a member.
   */
  @Get(':uuid/chat-room')
  @Permissions('all_privileges', 'read')
  async getChatRoom(@Param('uuid') uuid: string, @UserDecorator() user: User) {
    const meeting = await this.meetingsService.findByUuid(uuid)
    const chatRoom = await this.chatRoomService.findOrCreateMeetingRoom(
      meeting.id,
      meeting.uuid,
      user.id,
    )

    return { chatRoomUuid: chatRoom.uuid }
  }

  @Post(':uuid/generate-password')
  @Permissions('all_privileges', 'update')
  generatePassword(@Param('uuid') uuid: string, @UserDecorator() user: User) {
    return this.meetingsService.generatePassword(uuid, user.id)
  }

  /**
   * Sends invites to a list of users. Host only.
   * After saving, emits a real-time 'new_invite' event to each invited user
   * and 'invite_sent' to the meeting room. Starts a 30s auto-miss timer per invite.
   */
  @Post(':uuid/invites')
  @Permissions('all_privileges', 'create')
  async createInvites(
    @Param('uuid') uuid: string,
    @UserDecorator() user: User,
    @Body(ValidationPipe) dto: CreateInvitesDto,
  ) {
    const meeting = await this.meetingsService.findByUuid(uuid)

    // Skip users already inside the meeting room (live socket connection)
    const activeUserIds = this.meetingsGateway.getActiveUserIds(meeting.id)
    const filteredDto = {
      ...dto,
      user_ids: dto.user_ids.filter((userId) => !activeUserIds.has(userId)),
    }

    const invites = await this.meetingsService.createInvites(
      uuid,
      user.id,
      filteredDto,
      isPrivilegedUser(user.roles),
    )

    for (const invite of invites) {
      const userName = [invite.user?.first_name, invite.user?.last_name].filter(Boolean).join(' ')
      this.meetingsGateway.emitNewInvite(invite.user_id, {
        meetingId: meeting.id,
        meetingTitle: meeting.title,
        meetingUuid: meeting.uuid,
        inviteId: invite.id,
        userName,
        invitedBy: user.id,
      })
    }

    return invites
  }

  /**
   * Returns all invites with RSVP status. Host only.
   */
  @Get(':uuid/invites')
  @Permissions('all_privileges', 'read')
  getInvites(@Param('uuid') uuid: string, @UserDecorator() user: User) {
    return this.meetingsService.getInvites(uuid, user.id, isPrivilegedUser(user.roles))
  }

  /**
   * Returns all pending invites for the current user across all meetings.
   * Single endpoint replacing N per-meeting calls on the list page.
   */
  @Get('invites/pending')
  @Permissions('all_privileges', 'read')
  getMyPendingInvites(@UserDecorator() user: User) {
    return this.meetingsService.getPendingInvites(user.id)
  }

  /**
   * Returns all missed invites for the current user in the last 24 hours.
   * Called on app load to restore missed-call banners after the user was offline.
   */
  @Get('invites/missed')
  @Permissions('all_privileges', 'read')
  getMyMissedInvites(@UserDecorator() user: User) {
    return this.meetingsService.getMissedInvites(user.id)
  }

  /**
   * Returns the current user's invite for this meeting (for RSVP UI).
   */
  @Get(':uuid/invites/me')
  @Permissions('all_privileges', 'read')
  getMyInvite(@Param('uuid') uuid: string, @UserDecorator() user: User) {
    return this.meetingsService.getMyInvite(uuid, user.id)
  }

  /**
   * Records the RSVP response of the current user.
   * Cancels the auto-miss timer and broadcasts the result to the meeting room.
   */
  @Patch(':uuid/invites/rsvp')
  @Permissions('all_privileges', 'update')
  async rsvp(
    @Param('uuid') uuid: string,
    @UserDecorator() user: User,
    @Body(ValidationPipe) dto: RsvpDto,
  ) {
    const invite = await this.meetingsService.rsvp(uuid, user.id, dto)

    // Cancel the gateway timeout — user responded before the 30s window expired
    this.meetingsGateway.cancelInviteTimeout(invite.id)

    // Broadcast result to all participants currently in the meeting room
    if (dto.status === 'accepted' || dto.status === 'declined') {
      this.meetingsGateway.emitInviteResult(
        invite.meeting_id,
        uuid,
        user.id,
        user.full_name,
        dto.status,
      )
    }

    return invite
  }

  /**
   * Cancels an invite for a specific user. Host only.
   */
  @Delete(':uuid/invites/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions('all_privileges', 'delete')
  async cancelInvite(
    @Param('uuid') uuid: string,
    @Param('userId', ParseIntPipe) targetUserId: number,
    @UserDecorator() user: User,
  ) {
    const result = await this.meetingsService.cancelInvite(
      uuid,
      targetUserId,
      user.id,
      isPrivilegedUser(user.roles),
    )

    if (result) {
      // Stop the auto-miss timer so it does not fire after cancellation
      this.meetingsGateway.cancelInviteTimeout(result.inviteId)
      // Tell the invitee to dismiss the call notification immediately
      this.meetingsGateway.emitInviteCancelled(targetUserId, uuid)
    }
  }

  @Post(':uuid/speech')
  @Permissions('all_privileges', 'create')
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
