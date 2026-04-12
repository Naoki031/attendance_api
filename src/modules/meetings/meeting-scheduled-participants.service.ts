import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, In } from 'typeorm'
import { v4 as uuidv4 } from 'uuid'
import {
  MeetingScheduledParticipant,
  ScheduledParticipantStatus,
} from './entities/meeting_scheduled_participant.entity'
import {
  EmployeeRequest,
  EmployeeRequestStatus,
  EmployeeRequestType,
} from '@/modules/employee_requests/entities/employee_request.entity'
import { MeetingAutoCallConfig } from './entities/meeting_auto_call_config.entity'
import { MeetingInvite, MeetingInviteStatus } from './entities/meeting_invite.entity'
import { Meeting } from './entities/meeting.entity'
import { CreateScheduledParticipantsDto } from './dto/create-scheduled-participants.dto'
import { RsvpScheduledParticipantDto } from './dto/rsvp-scheduled-participant.dto'
import { UpsertAutoCallConfigDto } from './dto/upsert-auto-call-config.dto'
import { MailService } from '@/modules/mail/mail.service'
import { ConfigService } from '@nestjs/config'
import { isPrivilegedUser } from '@/common/utils/is-privileged.utility'
import { MeetingsGateway } from './meetings.gateway'
import moment from 'moment-timezone'

@Injectable()
export class MeetingScheduledParticipantsService {
  private readonly logger = new Logger(MeetingScheduledParticipantsService.name)

  constructor(
    @InjectRepository(MeetingScheduledParticipant)
    private readonly scheduledParticipantRepository: Repository<MeetingScheduledParticipant>,
    @InjectRepository(MeetingAutoCallConfig)
    private readonly autoCallConfigRepository: Repository<MeetingAutoCallConfig>,
    @InjectRepository(Meeting)
    private readonly meetingRepository: Repository<Meeting>,
    @InjectRepository(EmployeeRequest)
    private readonly employeeRequestRepository: Repository<EmployeeRequest>,
    @InjectRepository(MeetingInvite)
    private readonly inviteRepository: Repository<MeetingInvite>,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
    private readonly meetingsGateway: MeetingsGateway,
  ) {}

  /**
   * Returns the meeting or throws NotFoundException.
   */
  private async getMeeting(uuid: string): Promise<Meeting> {
    const meeting = await this.meetingRepository.findOne({ where: { uuid } })
    if (!meeting) throw new NotFoundException('Meeting not found')
    return meeting
  }

  /**
   * Asserts that the caller is the host or a privileged user.
   */
  private assertHost(meeting: Meeting, userId: number, roles: string[]): void {
    if (meeting.host_id !== userId && !isPrivilegedUser(roles)) {
      throw new ForbiddenException('Only the meeting host can manage scheduled participants')
    }
  }

  /**
   * Returns all scheduled participants for a meeting, including user details.
   */
  async findAll(meetingUuid: string): Promise<MeetingScheduledParticipant[]> {
    const meeting = await this.getMeeting(meetingUuid)
    return this.scheduledParticipantRepository.find({
      where: { meeting_id: meeting.id },
      relations: ['user'],
      order: { created_at: 'ASC' },
    })
  }

  /**
   * Adds users as scheduled participants. Skips duplicates (idempotent).
   * Sends RSVP invitation email to each new participant.
   */
  async create(
    meetingUuid: string,
    invitedByUserId: number,
    invitedByRoles: string[],
    dto: CreateScheduledParticipantsDto,
  ): Promise<MeetingScheduledParticipant[]> {
    const meeting = await this.meetingRepository.findOne({
      where: { uuid: meetingUuid },
      relations: ['host'],
    })
    if (!meeting) throw new NotFoundException('Meeting not found')
    this.assertHost(meeting, invitedByUserId, invitedByRoles)

    // Load existing participants to skip duplicates
    const existing = await this.scheduledParticipantRepository.find({
      where: { meeting_id: meeting.id },
    })
    const existingUserIds = new Set(existing.map((participant) => participant.user_id))

    const newUserIds = dto.user_ids.filter((id) => !existingUserIds.has(id))
    if (newUserIds.length === 0) return []

    const participants = newUserIds.map((userId) =>
      this.scheduledParticipantRepository.create({
        meeting_id: meeting.id,
        user_id: userId,
        invited_by: invitedByUserId,
        status: ScheduledParticipantStatus.PENDING,
        rsvp_token: uuidv4().replace(/-/g, ''),
      }),
    )

    await this.scheduledParticipantRepository.save(participants)

    // Load user details for email sending
    const withUsers = await this.scheduledParticipantRepository.find({
      where: { meeting_id: meeting.id, user_id: In(newUserIds) },
      relations: ['user'],
    })

    // Send RSVP emails (fire-and-forget) and push real-time invite via WebSocket
    for (const participant of withUsers) {
      if (participant.user?.email && participant.rsvp_token) {
        this.sendRsvpEmail(participant, meeting).catch((error) => {
          this.logger.error(
            `Failed to send RSVP email to user ${participant.user_id}: ${(error as Error).message}`,
          )
        })
      }

      // Notify the invitee in real time so the RSVP dialog appears without a page refresh
      this.meetingsGateway.emitScheduledInvite(participant.user_id, {
        id: participant.id,
        user_id: participant.user_id,
        meeting_id: participant.meeting_id,
        status: participant.status,
        created_at: participant.created_at,
        meeting: {
          uuid: meeting.uuid,
          title: meeting.title,
          description: meeting.description,
          meeting_type: meeting.meeting_type,
          scheduled_at: meeting.scheduled_at,
          schedule_time: meeting.schedule_time,
          schedule_day_of_week: meeting.schedule_day_of_week,
          host: meeting.host
            ? {
                id: meeting.host.id,
                first_name: meeting.host.first_name,
                last_name: meeting.host.last_name,
              }
            : undefined,
        },
      })
    }

    return withUsers
  }

  /**
   * Escapes HTML special characters to prevent HTML injection in email body.
   */
  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }

  /**
   * Sends the RSVP email with accept/decline links.
   */
  private async sendRsvpEmail(
    participant: MeetingScheduledParticipant,
    meeting: Meeting,
  ): Promise<void> {
    const clientUrl = this.configService.get<string>('CLIENT_URL', 'http://localhost')
    const userName = this.escapeHtml(participant.user?.full_name ?? 'there')
    const title = this.escapeHtml(meeting.title)
    const description = meeting.description ? this.escapeHtml(meeting.description) : null
    // scheduled_at is stored as UTC on the server — use moment.utc() to parse correctly
    const scheduledAt = meeting.scheduled_at
      ? moment.utc(meeting.scheduled_at).local().format('dddd, MMMM D YYYY [at] HH:mm')
      : 'TBD'

    const acceptUrl = `${clientUrl}/meetings/rsvp?token=${participant.rsvp_token}&status=accepted`
    const declineUrl = `${clientUrl}/meetings/rsvp?token=${participant.rsvp_token}&status=declined`

    await this.mailService.send({
      to: participant.user!.email!,
      subject: `Meeting invitation: ${meeting.title}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>You have been invited to a meeting</h2>
          <p>Hi ${userName},</p>
          <p>You have been invited to: <strong>${title}</strong></p>
          <p><strong>When:</strong> ${scheduledAt}</p>
          ${description ? `<p><strong>Description:</strong> ${description}</p>` : ''}
          <p>Please respond to this invitation:</p>
          <div style="margin: 24px 0;">
            <a href="${acceptUrl}" style="background:#4caf50;color:#fff;padding:12px 24px;border-radius:4px;text-decoration:none;margin-right:8px;">Accept</a>
            <a href="${declineUrl}" style="background:#f44336;color:#fff;padding:12px 24px;border-radius:4px;text-decoration:none;">Decline</a>
          </div>
          <p style="color:#999;font-size:12px;">This link is single-use and will expire after you respond.</p>
        </div>
      `,
    })
  }

  /**
   * Handles RSVP from email link (public, single-use token).
   * Clears the token after use.
   */
  async rsvpByToken(
    token: string,
    dto: RsvpScheduledParticipantDto,
  ): Promise<MeetingScheduledParticipant> {
    const participant = await this.scheduledParticipantRepository.findOne({
      where: { rsvp_token: token },
      relations: ['user', 'meeting'],
    })
    if (!participant) throw new NotFoundException('Invalid or already used RSVP token')

    participant.status = dto.status
    participant.rsvp_token = null // null clears the DB column; undefined would be skipped by TypeORM
    const saved = await this.scheduledParticipantRepository.save(participant)
    if (participant.meeting) {
      this.meetingsGateway.emitScheduledRsvpUpdated(participant.meeting.host_id, {
        meetingUuid: participant.meeting.uuid,
        userId: participant.user_id,
        status: dto.status,
      })
    }
    return saved
  }

  /**
   * Handles RSVP from authenticated user (in-app).
   */
  async rsvpByUser(
    meetingUuid: string,
    userId: number,
    dto: RsvpScheduledParticipantDto,
  ): Promise<MeetingScheduledParticipant> {
    const meeting = await this.getMeeting(meetingUuid)
    const participant = await this.scheduledParticipantRepository.findOne({
      where: { meeting_id: meeting.id, user_id: userId },
    })
    if (!participant) throw new NotFoundException('You are not a scheduled participant')

    participant.status = dto.status
    const saved = await this.scheduledParticipantRepository.save(participant)
    this.meetingsGateway.emitScheduledRsvpUpdated(meeting.host_id, {
      meetingUuid,
      userId,
      status: dto.status,
    })
    return saved
  }

  /**
   * Removes a scheduled participant. Host only.
   */
  async remove(
    meetingUuid: string,
    targetUserId: number,
    callerId: number,
    roles: string[],
  ): Promise<void> {
    const meeting = await this.getMeeting(meetingUuid)
    this.assertHost(meeting, callerId, roles)
    await this.scheduledParticipantRepository.delete({
      meeting_id: meeting.id,
      user_id: targetUserId,
    })
    this.meetingsGateway.emitScheduledInviteRemoved(targetUserId, meetingUuid)
  }

  /**
   * Returns all pending scheduled participant invites for the current user across all meetings.
   * Used to show the RSVP modal on page load.
   */
  async getMyPendingInvites(userId: number): Promise<MeetingScheduledParticipant[]> {
    return this.scheduledParticipantRepository.find({
      where: { user_id: userId, status: ScheduledParticipantStatus.PENDING },
      relations: ['meeting', 'meeting.host'],
      order: { created_at: 'DESC' },
    })
  }

  // ─── Auto-call config ──────────────────────────────────────────────────────

  /**
   * Returns the auto-call config for a meeting, or null if not set.
   */
  async getAutoCallConfig(meetingUuid: string): Promise<MeetingAutoCallConfig | null> {
    const meeting = await this.getMeeting(meetingUuid)
    return this.autoCallConfigRepository.findOne({ where: { meeting_id: meeting.id } }) ?? null
  }

  /**
   * Creates or updates the auto-call config for a meeting. Host only.
   */
  async upsertAutoCallConfig(
    meetingUuid: string,
    callerId: number,
    roles: string[],
    dto: UpsertAutoCallConfigDto,
  ): Promise<MeetingAutoCallConfig> {
    const meeting = await this.getMeeting(meetingUuid)
    this.assertHost(meeting, callerId, roles)

    let config = await this.autoCallConfigRepository.findOne({ where: { meeting_id: meeting.id } })

    if (!config) {
      config = this.autoCallConfigRepository.create({ meeting_id: meeting.id })
    }

    if (dto.minutes_before !== undefined) config.minutes_before = dto.minutes_before
    if (dto.retry_count !== undefined) config.retry_count = dto.retry_count
    if (dto.retry_interval_minutes !== undefined)
      config.retry_interval_minutes = dto.retry_interval_minutes
    if (dto.is_enabled !== undefined) config.is_enabled = dto.is_enabled
    if (dto.skip_weekends !== undefined) config.skip_weekends = dto.skip_weekends

    // Validate: all retries must complete before the meeting starts.
    // Last retry fires at triggerAt + retryCount × retryInterval; triggerAt = meetingStart − minutesBefore.
    // So retryCount × retryInterval must be strictly less than minutesBefore.
    if (
      config.retry_count > 0 &&
      config.retry_count * config.retry_interval_minutes > config.minutes_before
    ) {
      throw new BadRequestException(
        `Retry window (${config.retry_count} × ${config.retry_interval_minutes} min = ${config.retry_count * config.retry_interval_minutes} min) must be less than minutes_before (${config.minutes_before} min)`,
      )
    }

    const saved = await this.autoCallConfigRepository.save(config)

    // Notify all scheduled participants in real time so their manage-participants
    // dialog reflects the latest config without a page reload
    const participants = await this.scheduledParticipantRepository.find({
      where: { meeting_id: meeting.id },
      select: ['user_id'],
    })

    for (const participant of participants) {
      this.meetingsGateway.emitAutoCallConfigUpdated(participant.user_id, {
        meetingUuid,
        config: saved,
      })
    }

    return saved
  }

  /**
   * Resolves IANA timezones for multiple host users in a single query.
   * Falls back to Asia/Ho_Chi_Minh for any host without a configured timezone.
   */
  private async getHostTimezones(hostIds: number[]): Promise<Map<number, string>> {
    if (hostIds.length === 0) return new Map()
    const placeholders = hostIds.map(() => '?').join(',')
    const rows = (await this.meetingRepository.query(
      `SELECT ud.user_id, c.timezone
       FROM user_departments ud
       JOIN companies co ON co.id = ud.company_id
       JOIN countries c  ON c.id  = co.country_id
       WHERE ud.user_id IN (${placeholders}) AND c.timezone IS NOT NULL
       GROUP BY ud.user_id`,
      hostIds,
    )) as Array<{ user_id: number; timezone: string }>
    const map = new Map<number, string>()
    for (const row of rows) {
      map.set(row.user_id, row.timezone)
    }
    return map
  }

  /**
   * Returns user IDs that explicitly declined the auto-call for this meeting session.
   * Only invites declined on or after sessionStart are counted — this prevents a decline
   * from a previous daily/weekly session from blocking the next day's call.
   */
  private async getDeclinedUserIds(
    meetingId: number,
    sessionStart: moment.Moment,
  ): Promise<Set<number>> {
    const rows = await this.inviteRepository
      .createQueryBuilder('invite')
      .select('invite.user_id', 'user_id')
      .where('invite.meeting_id = :meetingId', { meetingId })
      .andWhere('invite.status = :status', { status: MeetingInviteStatus.DECLINED })
      .andWhere('invite.updated_at >= :sessionStart', { sessionStart: sessionStart.toDate() })
      .getRawMany<{ user_id: number }>()
    return new Set(rows.map((row) => row.user_id))
  }

  /**
   * Returns the set of user IDs that have an approved or pending OFF leave request
   * covering meetingTime — checked in a single batch query.
   */
  private async getUsersOnApprovedLeave(
    userIds: number[],
    meetingTime: moment.Moment,
  ): Promise<Set<number>> {
    if (userIds.length === 0) return new Set()
    const meetingDate = meetingTime.toDate()
    const rows = await this.employeeRequestRepository
      .createQueryBuilder('request')
      .select('request.user_id', 'user_id')
      .where('request.user_id IN (:...userIds)', { userIds })
      .andWhere('request.type = :type', { type: EmployeeRequestType.OFF })
      .andWhere('request.status = :status', { status: EmployeeRequestStatus.APPROVED })
      .andWhere('request.from_datetime <= :meetingTime', { meetingTime: meetingDate })
      .andWhere('request.to_datetime >= :meetingTime', { meetingTime: meetingDate })
      .getRawMany<{ user_id: number }>()
    return new Set(rows.map((row) => row.user_id))
  }

  /**
   * Returns the meeting start time for the current cron tick.
   *
   * - one_time: `scheduled_at` (stored as UTC)
   * - daily: today's date in the host timezone + `schedule_time`
   * - weekly: same as daily but returns null if today is not `schedule_day_of_week`
   *
   * Returns null if the meeting cannot produce a valid start time.
   */
  private computeMeetingStartAt(
    meeting: Meeting,
    timezone: string,
    skipWeekends = false,
  ): moment.Moment | null {
    if (!meeting) return null

    if (meeting.scheduled_at) {
      return moment.utc(meeting.scheduled_at)
    }

    if (!meeting.schedule_time) return null

    const nowInZone = moment.tz(timezone)
    const dayOfWeek = nowInZone.day() // 0 = Sunday, 6 = Saturday

    // Skip Saturday and Sunday for daily/weekly meetings when configured
    if (skipWeekends && (dayOfWeek === 0 || dayOfWeek === 6)) return null

    if (meeting.meeting_type === 'weekly') {
      if (meeting.schedule_day_of_week === null || meeting.schedule_day_of_week === undefined) {
        return null
      }
      if (nowInZone.day() !== meeting.schedule_day_of_week) return null
    }

    const todayInZone = nowInZone.format('YYYY-MM-DD')
    return moment.tz(`${todayInZone} ${meeting.schedule_time}`, 'YYYY-MM-DD HH:mm', timezone).utc()
  }

  /**
   * Returns the auto-call trigger time: meeting start time minus minutesBefore.
   * Derived from computeMeetingStartAt to avoid duplicating schedule logic.
   */
  private computeTriggerAt(
    meeting: Meeting,
    minutesBefore: number,
    timezone: string,
    skipWeekends = false,
  ): moment.Moment | null {
    const startAt = this.computeMeetingStartAt(meeting, timezone, skipWeekends)
    if (!startAt) return null
    return startAt.clone().subtract(minutesBefore, 'minutes')
  }

  /**
   * Returns all scheduled meetings with auto-call enabled that should fire within the next minute.
   * Used by the cron job.
   */
  async findUpcomingAutoCallTargets(): Promise<
    Array<{
      meeting: Meeting
      config: MeetingAutoCallConfig
      participants: MeetingScheduledParticipant[]
    }>
  > {
    const now = moment()
    // Window centered on now: catches triggers within ±30 seconds of cron fire time.
    // The 60-second cron period + 60-second window guarantees exactly one match per trigger,
    // and tolerates up to 30 seconds of Node.js event loop delay.
    const windowStart = now.clone().subtract(30, 'seconds')
    const windowEnd = now.clone().add(30, 'seconds')

    // Load all enabled configs
    const configs = await this.autoCallConfigRepository.find({
      where: { is_enabled: true },
      relations: ['meeting'],
    })

    const results: Array<{
      meeting: Meeting
      config: MeetingAutoCallConfig
      participants: MeetingScheduledParticipant[]
    }> = []

    // Batch timezone lookup for all host IDs in one query
    const hostIds = [...new Set(configs.map((config) => config.meeting.host_id))]
    const timezoneMap = await this.getHostTimezones(hostIds)

    for (const config of configs) {
      const meeting = config.meeting
      const timezone = timezoneMap.get(meeting.host_id) ?? 'Asia/Ho_Chi_Minh'
      const triggerAt = this.computeTriggerAt(
        meeting,
        config.minutes_before,
        timezone,
        config.skip_weekends,
      )
      if (!triggerAt) continue
      if (!triggerAt.isBetween(windowStart, windowEnd, undefined, '[)')) continue

      // Only accepted participants get auto-called
      const accepted = await this.scheduledParticipantRepository.find({
        where: { meeting_id: meeting.id, status: ScheduledParticipantStatus.ACCEPTED },
        relations: ['user'],
      })
      if (accepted.length === 0) continue

      const meetingStartAt = this.computeMeetingStartAt(meeting, timezone)

      let participants: MeetingScheduledParticipant[]
      if (meetingStartAt) {
        const onLeaveSet = await this.getUsersOnApprovedLeave(
          accepted.map((participant) => participant.user_id),
          meetingStartAt,
        )
        participants = accepted.filter((participant) => !onLeaveSet.has(participant.user_id))
      } else {
        participants = accepted
      }

      if (participants.length > 0) {
        results.push({ meeting, config, participants })
      }
    }

    return results
  }

  /**
   * Returns participants eligible for a retry call.
   * Called by cron: finds accepted participants that were called but did not join within the window.
   * Logic: retry fires at trigger_time + (attempt * retry_interval_minutes).
   */
  async findRetryAutoCallTargets(): Promise<
    Array<{
      meeting: Meeting
      config: MeetingAutoCallConfig
      participants: MeetingScheduledParticipant[]
      attempt: number
    }>
  > {
    const now = moment()
    const windowStart = now.clone().subtract(30, 'seconds')
    const windowEnd = now.clone().add(30, 'seconds')

    const configs = await this.autoCallConfigRepository.find({
      where: { is_enabled: true },
      relations: ['meeting'],
    })

    const results: Array<{
      meeting: Meeting
      config: MeetingAutoCallConfig
      participants: MeetingScheduledParticipant[]
      attempt: number
    }> = []

    // Batch timezone lookup for all host IDs in one query
    const retryHostIds = [...new Set(configs.map((config) => config.meeting.host_id))]
    const retryTimezoneMap = await this.getHostTimezones(retryHostIds)

    for (const config of configs) {
      if (config.retry_count === 0) continue
      const meeting = config.meeting
      const timezone = retryTimezoneMap.get(meeting.host_id) ?? 'Asia/Ho_Chi_Minh'
      const baseTriggerAt = this.computeTriggerAt(
        meeting,
        config.minutes_before,
        timezone,
        config.skip_weekends,
      )
      if (!baseTriggerAt) continue

      for (let attempt = 1; attempt <= config.retry_count; attempt++) {
        const retryAt = baseTriggerAt
          .clone()
          .add(attempt * config.retry_interval_minutes, 'minutes')
        if (!retryAt.isBetween(windowStart, windowEnd, undefined, '[)')) continue

        const accepted = await this.scheduledParticipantRepository.find({
          where: { meeting_id: meeting.id, status: ScheduledParticipantStatus.ACCEPTED },
          relations: ['user'],
        })
        if (accepted.length === 0) continue

        // Skip users who explicitly declined during this call session
        const declinedSet = await this.getDeclinedUserIds(meeting.id, baseTriggerAt)

        const meetingStartAt = this.computeMeetingStartAt(meeting, timezone)

        let participants: MeetingScheduledParticipant[]
        if (meetingStartAt) {
          const onLeaveSet = await this.getUsersOnApprovedLeave(
            accepted.map((participant) => participant.user_id),
            meetingStartAt,
          )
          participants = accepted.filter(
            (participant) =>
              !declinedSet.has(participant.user_id) && !onLeaveSet.has(participant.user_id),
          )
        } else {
          participants = accepted.filter((participant) => !declinedSet.has(participant.user_id))
        }

        if (participants.length > 0) {
          results.push({ meeting, config, participants, attempt })
        }
      }
    }

    return results
  }
}
