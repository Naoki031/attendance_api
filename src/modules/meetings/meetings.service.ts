import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ConfigService } from '@nestjs/config'
import { AccessToken } from 'livekit-server-sdk'
import { v4 as uuidv4 } from 'uuid'
import * as bcrypt from 'bcrypt'
import { Meeting, MeetingStatus, MeetingType } from './entities/meeting.entity'
import { MeetingParticipant, MeetingParticipantRole } from './entities/meeting_participant.entity'
import { CreateMeetingDto } from './dto/create-meeting.dto'
import { UpdateMeetingDto } from './dto/update-meeting.dto'
import { FilterMeetingDto } from './dto/filter-meeting.dto'

@Injectable()
export class MeetingsService {
  private readonly logger = new Logger(MeetingsService.name)

  constructor(
    @InjectRepository(Meeting)
    private readonly meetingRepository: Repository<Meeting>,
    @InjectRepository(MeetingParticipant)
    private readonly participantRepository: Repository<MeetingParticipant>,
    private readonly configService: ConfigService,
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
      scheduled_at: dto.scheduled_at ? new Date(dto.scheduled_at) : undefined,
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

    return Object.assign(saved, { plain_password: plainPassword }) as Meeting & {
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

  async findAll(filter: FilterMeetingDto): Promise<Meeting[]> {
    const query = this.meetingRepository
      .createQueryBuilder('meeting')
      .leftJoinAndSelect('meeting.host', 'host')
      .leftJoinAndSelect('meeting.participants', 'participants')
      .leftJoinAndSelect('participants.user', 'participantUser')

    if (filter.status) {
      query.andWhere('meeting.status = :status', { status: filter.status })
    }

    if (filter.search) {
      query.andWhere('meeting.title LIKE :search', { search: `%${filter.search}%` })
    }

    query.orderBy('meeting.created_at', 'DESC')

    return query.getMany()
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

  async update(uuid: string, userId: number, dto: UpdateMeetingDto): Promise<Meeting> {
    const meeting = await this.findByUuid(uuid)
    this.assertHost(meeting, userId)

    if (dto.title !== undefined) meeting.title = dto.title
    if (dto.description !== undefined) meeting.description = dto.description
    if (dto.meeting_type !== undefined) meeting.meeting_type = dto.meeting_type
    if (dto.scheduled_at !== undefined) meeting.scheduled_at = new Date(dto.scheduled_at)
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

    return this.meetingRepository.save(meeting)
  }

  async remove(uuid: string, userId: number): Promise<void> {
    const meeting = await this.findByUuid(uuid)
    this.assertHost(meeting, userId)
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
    }

    return jwt
  }

  async recordLeave(meetingId: number, userId: number): Promise<void> {
    await this.participantRepository.update(
      { meeting_id: meetingId, user_id: userId },
      { left_at: new Date() },
    )
  }

  /** Called when the first participant joins via socket — sets meeting to active. */
  async setActive(meetingId: number): Promise<void> {
    await this.meetingRepository.update(
      { id: meetingId, status: MeetingStatus.SCHEDULED },
      { status: MeetingStatus.ACTIVE, started_at: new Date() },
    )
  }

  /** Called when the last participant leaves — resets meeting to scheduled so it can be reused. */
  async resetToScheduled(meetingId: number): Promise<void> {
    await this.meetingRepository.update(
      { id: meetingId, status: MeetingStatus.ACTIVE },
      { status: MeetingStatus.SCHEDULED },
    )
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
        where: { meeting_id: meeting.id, left_at: undefined as unknown as null },
      })

      if (activeParticipants === 0) {
        await this.resetToScheduled(meeting.id)
        this.logger.warn(`Cleaned up stuck meeting #${meeting.id} (${meeting.uuid})`)
      }
    }
  }
}
