import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, In, MoreThan, IsNull } from 'typeorm'
import { ConfigService } from '@nestjs/config'
import { AccessToken } from 'livekit-server-sdk'
import { v4 as uuidv4 } from 'uuid'
import * as bcrypt from 'bcrypt'
import { Meeting, MeetingStatus, MeetingType } from './entities/meeting.entity'
import { MeetingParticipant, MeetingParticipantRole } from './entities/meeting_participant.entity'
import { MeetingPin } from './entities/meeting_pin.entity'
import { MeetingCompany } from './entities/meeting_company.entity'
import { MeetingInvite, MeetingInviteStatus } from './entities/meeting_invite.entity'
import { CreateMeetingDto } from './dto/create-meeting.dto'
import { UpdateMeetingDto } from './dto/update-meeting.dto'
import { FilterMeetingDto } from './dto/filter-meeting.dto'
import { CreateInvitesDto } from './dto/create-invites.dto'
import { RsvpDto } from './dto/rsvp.dto'
import moment from 'moment'
import { isPrivilegedUser } from '@/common/utils/is-privileged.utility'
import { UsersService } from '@/modules/users/users.service'

@Injectable()
export class MeetingsService {
  private readonly logger = new Logger(MeetingsService.name)

  constructor(
    @InjectRepository(Meeting)
    private readonly meetingRepository: Repository<Meeting>,
    @InjectRepository(MeetingParticipant)
    private readonly participantRepository: Repository<MeetingParticipant>,
    @InjectRepository(MeetingPin)
    private readonly meetingPinRepository: Repository<MeetingPin>,
    @InjectRepository(MeetingCompany)
    private readonly meetingCompanyRepository: Repository<MeetingCompany>,
    @InjectRepository(MeetingInvite)
    private readonly inviteRepository: Repository<MeetingInvite>,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {}

  async create(
    hostId: number,
    dto: CreateMeetingDto,
  ): Promise<Meeting & { plain_password?: string }> {
    let passwordHash: string | undefined
    let plainPassword: string | undefined

    if (dto.is_private) {
      plainPassword = dto.password ?? this.generateRandomPassword()
      passwordHash = await bcrypt.hash(plainPassword, 10)
    }

    const meeting = this.meetingRepository.create({
      title: dto.title,
      description: dto.description,
      host_id: hostId,
      status: MeetingStatus.SCHEDULED,
      livekit_room_name: `meeting-${uuidv4()}`,
      scheduled_at: dto.scheduled_at ? moment(dto.scheduled_at).toDate() : undefined,
      meeting_type: dto.meeting_type ?? MeetingType.ONE_TIME,
      schedule_time: dto.schedule_time,
      schedule_day_of_week: dto.schedule_day_of_week,
      schedule_interval_weeks: dto.schedule_interval_weeks,
      is_private: dto.is_private ?? false,
      password_hash: passwordHash,
    })

    const saved = await this.meetingRepository.save(meeting)

    const participant = this.participantRepository.create({
      meeting_id: saved.id,
      user_id: hostId,
      role: MeetingParticipantRole.HOST,
    })
    await this.participantRepository.save(participant)

    // Resolve company IDs: use provided list or fall back to host's companies
    const companyIds = dto.company_ids?.length
      ? dto.company_ids
      : await this.getCompanyIdsForUser(hostId)

    await this.syncMeetingCompanies(saved.id, companyIds)

    // Reload with meeting_companies so the client list can pre-fill the edit form
    const withCompanies = await this.meetingRepository.findOne({
      where: { id: saved.id },
      relations: ['meeting_companies'],
    })

    return Object.assign(withCompanies ?? saved, { plain_password: plainPassword }) as Meeting & {
      plain_password?: string
    }
  }

  /**
   * Generates a new password for a private meeting. Host only.
   * Returns the new plain-text password (only time it is exposed).
   */
  async generatePassword(uuid: string, userId: number): Promise<{ plain_password: string }> {
    const meeting = await this.findByUuid(uuid)
    this.assertHost(meeting, userId)

    const plainPassword = this.generateRandomPassword()
    const passwordHash = await bcrypt.hash(plainPassword, 10)

    await this.meetingRepository.update({ uuid }, { password_hash: passwordHash, is_private: true })

    return { plain_password: plainPassword }
  }

  async findAll(
    filter: FilterMeetingDto,
    userId: number,
    userRoles: string[] = [],
  ): Promise<(Meeting & { is_pinned: boolean })[]> {
    const isPrivileged = isPrivilegedUser(userRoles)

    const query = this.meetingRepository
      .createQueryBuilder('meeting')
      .leftJoinAndSelect('meeting.host', 'host')
      .leftJoinAndSelect('meeting.participants', 'participants')
      .leftJoinAndSelect('participants.user', 'participantUser')
      .leftJoinAndSelect('meeting.meeting_companies', 'meetingCompany')
      .leftJoinAndSelect('meetingCompany.company', 'company')
      .leftJoin('meeting.pins', 'pin', 'pin.user_id = :userId', { userId })
      .addSelect('CASE WHEN pin.id IS NOT NULL THEN 1 ELSE 0 END', 'is_pinned_raw')

    // Visibility: show meetings if the user is host, a participant, or shares a company with the meeting.
    // This ensures hosts/participants always see their meetings even if user_departments is empty.
    if (!isPrivileged) {
      query.andWhere(
        `(
          meeting.host_id = :userId
          OR meeting.id IN (
            SELECT p.meeting_id FROM meeting_participants p
            WHERE p.user_id = :userId
          )
          OR meeting.id IN (
            SELECT mc.meeting_id FROM meeting_companies mc
            INNER JOIN user_departments ud ON ud.company_id = mc.company_id
            WHERE ud.user_id = :userId
          )
        )`,
        { userId },
      )
    }

    if (filter.status) {
      query.andWhere('meeting.status = :status', { status: filter.status })
    }

    if (filter.search) {
      query.andWhere('meeting.title LIKE :search', { search: `%${filter.search}%` })
    }

    query.orderBy('is_pinned_raw', 'DESC').addOrderBy('meeting.created_at', 'DESC')

    const raws = await query.getRawAndEntities()

    // Raw array may have more rows than entities due to leftJoinAndSelect on
    // participants × companies producing duplicate rows. Build a map keyed by
    // meeting ID so each entity gets its correct is_pinned value.
    const pinnedMap = new Map<number, boolean>()
    for (const raw of raws.raw as Record<string, unknown>[]) {
      const meetingId = Number(raw['meeting_id'])
      if (!pinnedMap.has(meetingId)) {
        pinnedMap.set(meetingId, raw['is_pinned_raw'] === '1' || raw['is_pinned_raw'] === 1)
      }
    }

    return raws.entities.map((meeting) =>
      Object.assign(meeting, { is_pinned: pinnedMap.get(meeting.id) ?? false }),
    )
  }

  /**
   * Pins a meeting for the given user. Idempotent — safe to call if already pinned.
   */
  async pin(uuid: string, userId: number): Promise<void> {
    const meeting = await this.findByUuid(uuid)
    await this.meetingPinRepository
      .createQueryBuilder()
      .insert()
      .into(MeetingPin)
      .values({ user_id: userId, meeting_id: meeting.id })
      .orIgnore()
      .execute()
  }

  /**
   * Unpins a meeting for the given user. Idempotent — safe to call if not pinned.
   */
  async unpin(uuid: string, userId: number): Promise<void> {
    const meeting = await this.findByUuid(uuid)
    await this.meetingPinRepository.delete({ user_id: userId, meeting_id: meeting.id })
  }

  async findByUuid(uuid: string): Promise<Meeting> {
    const meeting = await this.meetingRepository.findOne({
      where: { uuid },
      relations: ['host', 'participants', 'participants.user'],
    })

    if (!meeting) {
      throw new NotFoundException(`Meeting ${uuid} not found`)
    }

    return meeting
  }

  /**
   * Returns users who belong to the companies associated with this meeting.
   * Used to populate the host schedule user selector.
   */
  async findUsersForMeeting(uuid: string) {
    const meeting = await this.meetingRepository.findOne({ where: { uuid } })
    if (!meeting) throw new NotFoundException(`Meeting ${uuid} not found`)

    const companyRows = await this.meetingCompanyRepository.find({
      where: { meeting_id: meeting.id },
    })
    const companyIds = companyRows.map((row) => row.company_id)

    if (companyIds.length === 0) return this.usersService.findAll()

    return this.usersService.findWithFilters({ companyIds })
  }

  // Kept for internal use (e.g. recordLeave)
  async findById(id: number): Promise<Meeting> {
    const meeting = await this.meetingRepository.findOne({
      where: { id },
      relations: ['host', 'participants', 'participants.user'],
    })

    if (!meeting) {
      throw new NotFoundException(`Meeting #${id} not found`)
    }

    return meeting
  }

  /** Lightweight check that returns only host_id — avoids loading relations. */
  async findHostIdById(id: number): Promise<number | null> {
    const meeting = await this.meetingRepository.findOne({ where: { id }, select: ['host_id'] })
    return meeting?.host_id ?? null
  }

  async update(
    uuid: string,
    userId: number,
    dto: UpdateMeetingDto,
    isPrivileged = false,
  ): Promise<Meeting> {
    const meeting = await this.findByUuid(uuid)
    this.assertCanManage(meeting, userId, isPrivileged)

    if (dto.title !== undefined) meeting.title = dto.title
    if (dto.description !== undefined) meeting.description = dto.description
    if (dto.meeting_type !== undefined) meeting.meeting_type = dto.meeting_type
    if (dto.scheduled_at !== undefined) meeting.scheduled_at = moment(dto.scheduled_at).toDate()
    if (dto.schedule_time !== undefined) meeting.schedule_time = dto.schedule_time
    if (dto.schedule_day_of_week !== undefined)
      meeting.schedule_day_of_week = dto.schedule_day_of_week
    if (dto.schedule_interval_weeks !== undefined)
      meeting.schedule_interval_weeks = dto.schedule_interval_weeks

    if (dto.is_private !== undefined) {
      meeting.is_private = dto.is_private

      if (dto.is_private && dto.password) {
        meeting.password_hash = await bcrypt.hash(dto.password, 10)
      } else if (!dto.is_private) {
        meeting.password_hash = undefined as unknown as null
      }
    }

    const saved = await this.meetingRepository.save(meeting)

    if (dto.company_ids !== undefined) {
      await this.syncMeetingCompanies(meeting.id, dto.company_ids)
    }

    // Reload with meeting_companies so the client list can pre-fill the edit form
    const withCompanies = await this.meetingRepository.findOne({
      where: { id: saved.id },
      relations: ['meeting_companies'],
    })

    return withCompanies ?? saved
  }

  /**
   * Deletes a meeting. Allowed for the host, admin, or super admin.
   * Cannot delete a meeting that is currently active (has participants inside).
   */
  async remove(uuid: string, userId: number, roles: string[] = []): Promise<void> {
    const meeting = await this.findByUuid(uuid)
    this.assertHostOrAdmin(meeting, userId, roles)

    if (meeting.status === MeetingStatus.ACTIVE) {
      throw new ForbiddenException('Cannot delete a meeting that is currently active')
    }

    await this.meetingRepository.remove(meeting)
  }

  async generateToken(
    uuid: string,
    userId: number,
    username: string,
    password?: string,
  ): Promise<string> {
    const meeting = await this.findByUuid(uuid)

    if (meeting.is_private && meeting.host_id !== userId) {
      if (!password) {
        throw new ForbiddenException('Password required to join private meeting')
      }

      const isValid = await bcrypt.compare(password, meeting.password_hash ?? '')

      if (!isValid) {
        throw new ForbiddenException('Incorrect meeting password')
      }
    }

    const apiKey = this.configService.get<string>('LIVEKIT_API_KEY') ?? ''
    const apiSecret = this.configService.get<string>('LIVEKIT_API_SECRET') ?? ''

    const token = new AccessToken(apiKey, apiSecret, {
      identity: String(userId),
      name: username,
    })

    token.addGrant({
      roomJoin: true,
      room: meeting.livekit_room_name,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    })

    const jwt = await token.toJwt()

    // Only insert participant if not already recorded (host is added during create())
    const existing = await this.participantRepository.findOne({
      where: { meeting_id: meeting.id, user_id: userId },
    })
    if (!existing) {
      const participant = this.participantRepository.create({
        meeting_id: meeting.id,
        user_id: userId,
        role: MeetingParticipantRole.PARTICIPANT,
      })
      await this.participantRepository.save(participant)
    } else if (existing.left_at != null) {
      // Participant is rejoining — clear left_at so cleanupStuckMeetings counts them correctly
      await this.participantRepository.update(
        { id: existing.id },
        { left_at: null as unknown as Date },
      )
    }

    return jwt
  }

  async recordLeave(meetingId: number, userId: number): Promise<void> {
    await this.participantRepository.update(
      { meeting_id: meetingId, user_id: userId },
      { left_at: moment().toDate() },
    )
  }

  /** Called when the first participant joins via socket — sets meeting to active. */
  async setActive(meetingId: number): Promise<void> {
    await this.meetingRepository.update(
      { id: meetingId, status: MeetingStatus.SCHEDULED },
      { status: MeetingStatus.ACTIVE, started_at: moment().toDate() },
    )
  }

  /** Called when the last participant leaves — resets meeting to scheduled so it can be reused. */
  async resetToScheduled(meetingId: number): Promise<void> {
    await this.meetingRepository.update(
      { id: meetingId, status: MeetingStatus.ACTIVE },
      { status: MeetingStatus.SCHEDULED },
    )
  }

  private assertHostOrAdmin(meeting: Meeting, userId: number, roles: string[] = []): void {
    if (meeting.host_id === userId) return
    if (isPrivilegedUser(roles)) return

    throw new ForbiddenException('Only the host or an admin can perform this action')
  }

  private assertCanManage(meeting: Meeting, userId: number, isPrivileged: boolean): void {
    if (isPrivileged) return
    if (meeting.host_id !== userId) {
      throw new ForbiddenException('Only the host or an admin can perform this action')
    }
  }

  private assertHost(meeting: Meeting, userId: number): void {
    if (meeting.host_id !== userId) {
      throw new ForbiddenException('Only the host can perform this action')
    }
  }

  private generateRandomPassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

    return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  }

  /**
   * Delete meetings whose last usage date (started_at) is more than 1 month ago.
   * Runs at midnight every day.
   */
  @Cron('0 0 * * *')
  async deleteOldMeetings(): Promise<void> {
    const oneMonthAgo = moment().subtract(1, 'month').toDate()

    const oldMeetings = await this.meetingRepository
      .createQueryBuilder('meeting')
      .where('meeting.started_at < :oneMonthAgo', { oneMonthAgo })
      .andWhere('meeting.status != :status', { status: MeetingStatus.ACTIVE })
      .getMany()

    if (oldMeetings.length === 0) return

    await this.meetingRepository.remove(oldMeetings)
    this.logger.log(`Deleted ${oldMeetings.length} old meeting(s) with last usage over 1 month ago`)
  }

  /**
   * Reset meetings stuck in ACTIVE status every 5 minutes.
   * A meeting is "stuck" when it is ACTIVE but has no participants
   * (e.g. server restarted while meeting was in progress).
   */
  @Cron('*/5 * * * *')
  async cleanupStuckMeetings(): Promise<void> {
    const stuckMeetings = await this.meetingRepository.find({
      where: { status: MeetingStatus.ACTIVE },
    })

    for (const meeting of stuckMeetings) {
      // Check if any participant is still in the meeting (no left_at)
      const activeParticipants = await this.participantRepository.count({
        where: { meeting_id: meeting.id, left_at: IsNull() },
      })

      if (activeParticipants === 0) {
        await this.resetToScheduled(meeting.id)
        this.logger.warn(`Cleaned up stuck meeting #${meeting.id} (${meeting.uuid})`)
      }
    }
  }

  /**
   * Sends invites to a list of users for a meeting.
   * Only the host (or privileged user) can invite.
   * Already-invited users are skipped silently.
   */
  async createInvites(
    meetingUuid: string,
    inviterId: number,
    dto: CreateInvitesDto,
    isPrivileged: boolean,
  ): Promise<MeetingInvite[]> {
    const meeting = await this.findByUuid(meetingUuid)
    if (meeting.host_id !== inviterId && !isPrivileged) {
      throw new ForbiddenException('Only the host can send invites')
    }

    // Guard: TypeORM find({ where: [] }) with an empty array returns ALL rows (no WHERE clause).
    // Return early to avoid accidentally re-inviting everyone previously invited.
    if (dto.user_ids.length === 0) return []

    const existing = await this.inviteRepository.find({
      where: dto.user_ids.map((userId) => ({ meeting_id: meeting.id, user_id: userId })),
      select: ['id', 'user_id', 'status'],
    })

    // Skip users who already have a pending invite (still waiting to respond)
    // Accepted invites from a previous session are treated as completed — user can be re-invited
    const existingActiveIds = new Set(
      existing
        .filter((invite) => invite.status === MeetingInviteStatus.PENDING)
        .map((invite) => invite.user_id),
    )

    // Re-invite users whose previous invite was accepted, missed, or declined (reset to pending)
    const toReinvite = existing.filter((invite) => invite.status !== MeetingInviteStatus.PENDING)
    const reinvitedIds: number[] = []
    for (const invite of toReinvite) {
      await this.inviteRepository.update({ id: invite.id }, { status: MeetingInviteStatus.PENDING })
      reinvitedIds.push(invite.id)
    }

    // Create fresh invites for users with no previous invite
    const newUserIds = dto.user_ids.filter(
      (userId) =>
        !existingActiveIds.has(userId) && !toReinvite.some((invite) => invite.user_id === userId),
    )
    const newInvites = newUserIds.map((userId) =>
      this.inviteRepository.create({
        meeting_id: meeting.id,
        user_id: userId,
        invited_by: inviterId,
        status: MeetingInviteStatus.PENDING,
      }),
    )
    const savedNew = await this.inviteRepository.save(newInvites)

    // Return all newly created + re-invited records with user relation loaded
    const allIds = [...savedNew.map((invite) => invite.id), ...reinvitedIds]
    if (allIds.length === 0) return []

    return this.inviteRepository.find({
      where: { id: In(allIds) },
      relations: ['user'],
    })
  }

  /**
   * Marks a pending invite as missed (called by the gateway timeout).
   * Only updates if the invite is still pending to avoid overwriting a late response.
   */
  async markInviteMissed(meetingId: number, userId: number): Promise<void> {
    await this.inviteRepository.update(
      { meeting_id: meetingId, user_id: userId, status: MeetingInviteStatus.PENDING },
      { status: MeetingInviteStatus.MISSED },
    )
  }

  /**
   * Returns all invites for a meeting with user info.
   * Only the host (or privileged user) can view all invites.
   */
  async getInvites(meetingUuid: string, requesterId: number, isPrivileged: boolean) {
    const meeting = await this.findByUuid(meetingUuid)
    if (meeting.host_id !== requesterId && !isPrivileged) {
      throw new ForbiddenException('Only the host can view invites')
    }

    return this.inviteRepository.find({
      where: { meeting_id: meeting.id },
      relations: ['user'],
      order: { created_at: 'ASC' },
    })
  }

  /**
   * Records the RSVP response of an invited user.
   * Only the invited user themselves can respond.
   */
  async rsvp(meetingUuid: string, userId: number, dto: RsvpDto): Promise<MeetingInvite> {
    const meeting = await this.findByUuid(meetingUuid)
    let invite = await this.inviteRepository.findOne({
      where: { meeting_id: meeting.id, user_id: userId },
    })

    if (!invite) {
      // Invite was cancelled or deleted (e.g., host cancelled while invitee was offline).
      // Re-create so the user can still respond and join.
      invite = await this.inviteRepository.save(
        this.inviteRepository.create({
          meeting_id: meeting.id,
          user_id: userId,
          invited_by: meeting.host_id,
          status: dto.status as MeetingInviteStatus,
        }),
      )
      return invite
    }

    await this.inviteRepository.update(
      { id: invite.id },
      { status: dto.status as MeetingInviteStatus },
    )
    return (await this.inviteRepository.findOne({ where: { id: invite.id } })) as MeetingInvite
  }

  /**
   * Cancels (removes) an invite. Only the host or privileged user can cancel.
   */
  async cancelInvite(
    meetingUuid: string,
    targetUserId: number,
    requesterId: number,
    isPrivileged: boolean,
  ): Promise<{ inviteId: number; meetingId: number } | null> {
    const meeting = await this.findByUuid(meetingUuid)
    if (meeting.host_id !== requesterId && !isPrivileged) {
      throw new ForbiddenException('Only the host can cancel invites')
    }

    const invite = await this.inviteRepository.findOne({
      where: { meeting_id: meeting.id, user_id: targetUserId },
    })

    await this.inviteRepository.delete({ meeting_id: meeting.id, user_id: targetUserId })

    return invite ? { inviteId: invite.id, meetingId: meeting.id } : null
  }

  /**
   * Returns all missed invites for the current user from the last 24 hours.
   * Used to restore missed-call banners when the user comes back online.
   */
  async getMissedInvites(
    userId: number,
  ): Promise<{ meetingTitle: string; meetingUuid: string; missedAt: string }[]> {
    const since = moment().subtract(24, 'hours').toDate()

    const invites = await this.inviteRepository.find({
      where: {
        user_id: userId,
        status: MeetingInviteStatus.MISSED,
        updated_at: MoreThan(since),
      },
      relations: ['meeting'],
      order: { updated_at: 'DESC' },
    })

    return invites
      .filter((invite) => invite.meeting)
      .map((invite) => ({
        meetingTitle: invite.meeting.title,
        meetingUuid: invite.meeting.uuid,
        missedAt: invite.updated_at
          ? moment.utc(invite.updated_at).toISOString()
          : moment().toISOString(),
      }))
  }

  /**
   * Returns all pending invites for the current user across all meetings.
   * Used to populate RSVP banners on the meetings list page in a single query.
   */
  async getPendingInvites(userId: number): Promise<MeetingInvite[]> {
    return this.inviteRepository.find({
      where: { user_id: userId, status: MeetingInviteStatus.PENDING },
      relations: ['meeting'],
      order: { created_at: 'DESC' },
    })
  }

  /**
   * Returns the current user's RSVP status for a meeting (if invited).
   */
  async getMyInvite(meetingUuid: string, userId: number): Promise<MeetingInvite | null> {
    const meeting = await this.findByUuid(meetingUuid)
    return this.inviteRepository.findOne({
      where: { meeting_id: meeting.id, user_id: userId },
    })
  }

  /**
   * Returns all company IDs the user belongs to via user_departments.
   */
  private async getCompanyIdsForUser(userId: number): Promise<number[]> {
    const rows = (await this.meetingRepository.manager.query(
      'SELECT DISTINCT company_id FROM user_departments WHERE user_id = ?',
      [userId],
    )) as Array<{ company_id: number }>
    return rows.map((row) => row.company_id)
  }

  /**
   * Replaces all company associations for a meeting with the given list.
   */
  private async syncMeetingCompanies(meetingId: number, companyIds: number[]): Promise<void> {
    await this.meetingCompanyRepository.delete({ meeting_id: meetingId })
    if (companyIds.length === 0) return
    const rows = companyIds.map((companyId) =>
      this.meetingCompanyRepository.create({ meeting_id: meetingId, company_id: companyId }),
    )
    await this.meetingCompanyRepository.save(rows)
  }
}
