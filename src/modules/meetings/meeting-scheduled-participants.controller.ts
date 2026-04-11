import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  UseInterceptors,
  ClassSerializerInterceptor,
  ValidationPipe,
  ParseIntPipe,
} from '@nestjs/common'
import { MeetingScheduledParticipantsService } from './meeting-scheduled-participants.service'
import { CreateScheduledParticipantsDto } from './dto/create-scheduled-participants.dto'
import { RsvpScheduledParticipantDto } from './dto/rsvp-scheduled-participant.dto'
import { UpsertAutoCallConfigDto } from './dto/upsert-auto-call-config.dto'
import { User as UserDecorator } from '@/modules/auth/decorators/user.decorator'
import type { User } from '@/modules/users/entities/user.entity'
import { PermissionsGuard } from '@/modules/permissions/guards/permissions.guard'
import { Permissions } from '@/modules/permissions/decorators/permissions.decorator'
import { Public } from '@/modules/auth/decorators/public.decorator'

@Controller('meetings')
@UseGuards(PermissionsGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class MeetingScheduledParticipantsController {
  constructor(private readonly scheduledParticipantsService: MeetingScheduledParticipantsService) {}

  /**
   * Returns all scheduled participants for a meeting.
   */
  @Get(':uuid/scheduled-participants')
  @Permissions('all_privileges', 'read')
  findAll(@Param('uuid') uuid: string) {
    return this.scheduledParticipantsService.findAll(uuid)
  }

  /**
   * Returns all pending scheduled participant invites for the current user across all meetings.
   * Loaded on page open to show the RSVP modal.
   */
  @Get('scheduled-participants/my-pending')
  @Permissions('all_privileges', 'read')
  getMyPendingInvites(@UserDecorator() user: User) {
    return this.scheduledParticipantsService.getMyPendingInvites(user.id)
  }

  /**
   * Adds users as scheduled participants and sends RSVP emails. Host only.
   */
  @Post(':uuid/scheduled-participants')
  @Permissions('all_privileges', 'create')
  create(
    @Param('uuid') uuid: string,
    @UserDecorator() user: User,
    @Body(ValidationPipe) dto: CreateScheduledParticipantsDto,
  ) {
    return this.scheduledParticipantsService.create(uuid, user.id, user.roles, dto)
  }

  /**
   * RSVP as the authenticated user (in-app response).
   */
  @Patch(':uuid/scheduled-participants/rsvp')
  @Permissions('all_privileges', 'update')
  rsvpByUser(
    @Param('uuid') uuid: string,
    @UserDecorator() user: User,
    @Body(ValidationPipe) dto: RsvpScheduledParticipantDto,
  ) {
    return this.scheduledParticipantsService.rsvpByUser(uuid, user.id, dto)
  }

  /**
   * Removes a scheduled participant. Host only.
   */
  @Delete(':uuid/scheduled-participants/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions('all_privileges', 'delete')
  remove(
    @Param('uuid') uuid: string,
    @Param('userId', ParseIntPipe) targetUserId: number,
    @UserDecorator() user: User,
  ) {
    return this.scheduledParticipantsService.remove(uuid, targetUserId, user.id, user.roles)
  }

  // ─── Auto-call config ──────────────────────────────────────────────────────

  /**
   * Returns the auto-call config for a meeting.
   */
  @Get(':uuid/auto-call-config')
  @Permissions('all_privileges', 'read')
  getAutoCallConfig(@Param('uuid') uuid: string) {
    return this.scheduledParticipantsService.getAutoCallConfig(uuid)
  }

  /**
   * Creates or updates the auto-call config. Host only.
   */
  @Patch(':uuid/auto-call-config')
  @Permissions('all_privileges', 'update')
  upsertAutoCallConfig(
    @Param('uuid') uuid: string,
    @UserDecorator() user: User,
    @Body(ValidationPipe) dto: UpsertAutoCallConfigDto,
  ) {
    return this.scheduledParticipantsService.upsertAutoCallConfig(uuid, user.id, user.roles, dto)
  }

  // ─── Public RSVP via email token ───────────────────────────────────────────

  /**
   * Handles RSVP from email link — no auth required.
   * The token is single-use and cleared after a successful response.
   * Returns only the status — the full entity is never exposed on a public endpoint.
   */
  @Public()
  @Patch('scheduled-participants/rsvp-by-token/:token')
  async rsvpByToken(
    @Param('token') token: string,
    @Body(ValidationPipe) dto: RsvpScheduledParticipantDto,
  ): Promise<{ status: string }> {
    const saved = await this.scheduledParticipantsService.rsvpByToken(token, dto)
    return { status: saved.status }
  }
}
