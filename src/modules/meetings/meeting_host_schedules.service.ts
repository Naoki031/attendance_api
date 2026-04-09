import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { MeetingHostSchedule, HostScheduleType } from './entities/meeting_host_schedule.entity'
import { Meeting } from './entities/meeting.entity'
import { CreateHostScheduleDto } from './dto/create-host-schedule.dto'
import { UpdateHostScheduleDto } from './dto/update-host-schedule.dto'

/** Priority order: most specific type wins when multiple schedules match the same date. */
const SCHEDULE_TYPE_PRIORITY: Record<HostScheduleType, number> = {
  [HostScheduleType.ONE_TIME]: 4,
  [HostScheduleType.DATE_LIST]: 3,
  [HostScheduleType.DATE_RANGE]: 2,
  [HostScheduleType.RECURRING]: 1,
}

@Injectable()
export class MeetingHostSchedulesService {
  constructor(
    @InjectRepository(MeetingHostSchedule)
    private readonly scheduleRepository: Repository<MeetingHostSchedule>,
    @InjectRepository(Meeting)
    private readonly meetingRepository: Repository<Meeting>,
  ) {}

  async create(
    meetingUuid: string,
    requestUserId: number,
    dto: CreateHostScheduleDto,
    isPrivileged = false,
  ): Promise<MeetingHostSchedule> {
    const meeting = await this.findMeetingByUuid(meetingUuid)
    this.assertCanManage(meeting, requestUserId, isPrivileged)

    const schedule = this.scheduleRepository.create({
      meeting_id: meeting.id,
      user_id: dto.user_id,
      schedule_type: dto.schedule_type,
      date: dto.date,
      dates: dto.dates,
      date_from: dto.date_from,
      date_to: dto.date_to,
      day_of_week: dto.day_of_week,
      interval_weeks: dto.interval_weeks,
      recur_start_date: dto.recur_start_date,
      recur_end_date: dto.recur_end_date,
      is_active: true,
    })

    const saved = await this.scheduleRepository.save(schedule)
    return this.scheduleRepository.findOne({
      where: { id: saved.id },
      relations: ['user'],
    }) as Promise<MeetingHostSchedule>
  }

  async findAll(meetingUuid: string): Promise<MeetingHostSchedule[]> {
    const meeting = await this.findMeetingByUuid(meetingUuid)

    return this.scheduleRepository.find({
      where: { meeting_id: meeting.id },
      relations: ['user'],
      order: { created_at: 'DESC' },
    })
  }

  async update(
    scheduleId: number,
    meetingUuid: string,
    requestUserId: number,
    dto: UpdateHostScheduleDto,
    isPrivileged = false,
  ): Promise<MeetingHostSchedule> {
    const meeting = await this.findMeetingByUuid(meetingUuid)
    this.assertCanManage(meeting, requestUserId, isPrivileged)

    const schedule = await this.findScheduleById(scheduleId, meeting.id)

    if (dto.user_id !== undefined) schedule.user_id = dto.user_id
    if (dto.schedule_type !== undefined) schedule.schedule_type = dto.schedule_type
    if (dto.date !== undefined) schedule.date = dto.date
    if (dto.dates !== undefined) schedule.dates = dto.dates
    if (dto.date_from !== undefined) schedule.date_from = dto.date_from
    if (dto.date_to !== undefined) schedule.date_to = dto.date_to
    if (dto.day_of_week !== undefined) schedule.day_of_week = dto.day_of_week
    if (dto.interval_weeks !== undefined) schedule.interval_weeks = dto.interval_weeks
    if (dto.recur_start_date !== undefined) schedule.recur_start_date = dto.recur_start_date
    if (dto.recur_end_date !== undefined) schedule.recur_end_date = dto.recur_end_date
    if (dto.is_active !== undefined) schedule.is_active = dto.is_active

    await this.scheduleRepository.save(schedule)
    return this.scheduleRepository.findOne({
      where: { id: schedule.id },
      relations: ['user'],
    }) as Promise<MeetingHostSchedule>
  }

  async remove(
    scheduleId: number,
    meetingUuid: string,
    requestUserId: number,
    isPrivileged = false,
  ): Promise<void> {
    const meeting = await this.findMeetingByUuid(meetingUuid)
    this.assertCanManage(meeting, requestUserId, isPrivileged)

    const schedule = await this.findScheduleById(scheduleId, meeting.id)
    await this.scheduleRepository.remove(schedule)
  }

  /**
   * Resolve which userId should be host for a given meeting on a given date.
   * Falls back to meeting.host_id (owner) when no schedule matches.
   */
  async resolveHostForDate(meetingId: number, date: string): Promise<number> {
    const meeting = await this.meetingRepository.findOne({ where: { id: meetingId } })
    if (!meeting) throw new NotFoundException(`Meeting #${meetingId} not found`)

    const schedules = await this.scheduleRepository.find({
      where: { meeting_id: meetingId, is_active: true },
    })

    const matching = schedules.filter((schedule) => this.matchesDate(schedule, date))

    if (matching.length === 0) return meeting.host_id

    // Pick the most specific (highest priority). Tie-break: latest created_at.
    matching.sort((scheduleA, scheduleB) => {
      const priorityDiff =
        SCHEDULE_TYPE_PRIORITY[scheduleB.schedule_type] -
        SCHEDULE_TYPE_PRIORITY[scheduleA.schedule_type]
      if (priorityDiff !== 0) return priorityDiff
      return scheduleB.created_at.getTime() - scheduleA.created_at.getTime()
    })

    return matching[0]!.user_id
  }

  /** Same as resolveHostForDate but accepts a meeting UUID — used by the HTTP endpoint. */
  async resolveHostForDateByUuid(meetingUuid: string, date: string): Promise<number> {
    const meeting = await this.findMeetingByUuid(meetingUuid)

    return this.resolveHostForDate(meeting.id, date)
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private matchesDate(schedule: MeetingHostSchedule, dateString: string): boolean {
    switch (schedule.schedule_type) {
      case HostScheduleType.ONE_TIME:
        return schedule.date === dateString

      case HostScheduleType.DATE_LIST:
        return (schedule.dates ?? []).includes(dateString)

      case HostScheduleType.DATE_RANGE: {
        if (!schedule.date_from || !schedule.date_to) return false

        return dateString >= schedule.date_from && dateString <= schedule.date_to
      }

      case HostScheduleType.RECURRING: {
        if (
          schedule.day_of_week === undefined ||
          schedule.day_of_week === null ||
          !schedule.interval_weeks ||
          !schedule.recur_start_date
        ) {
          return false
        }

        if (schedule.recur_end_date && dateString > schedule.recur_end_date) return false

        const target = new Date(dateString + 'T00:00:00Z')

        // Must match the configured day of week first
        if (target.getUTCDay() !== schedule.day_of_week) return false

        // Find the first occurrence of day_of_week on or after recur_start_date.
        // recur_start_date does NOT need to be on the same day_of_week.
        const anchor = new Date(schedule.recur_start_date + 'T00:00:00Z')
        const daysUntilFirst = (schedule.day_of_week - anchor.getUTCDay() + 7) % 7
        const firstOccurrence = new Date(anchor)
        firstOccurrence.setUTCDate(firstOccurrence.getUTCDate() + daysUntilFirst)

        // target must be on or after the first occurrence
        if (target < firstOccurrence) return false

        // weekDiff between two UTC-midnight dates with the same day_of_week
        // is always an exact integer number of weeks — no rounding needed.
        const msPerWeek = 7 * 24 * 60 * 60 * 1000
        const weekDiff = (target.getTime() - firstOccurrence.getTime()) / msPerWeek

        return weekDiff % schedule.interval_weeks === 0
      }

      default:
        return false
    }
  }

  private async findMeetingByUuid(uuid: string): Promise<Meeting> {
    const meeting = await this.meetingRepository.findOne({ where: { uuid } })
    if (!meeting) throw new NotFoundException(`Meeting ${uuid} not found`)

    return meeting
  }

  private async findScheduleById(
    scheduleId: number,
    meetingId: number,
  ): Promise<MeetingHostSchedule> {
    const schedule = await this.scheduleRepository.findOne({
      where: { id: scheduleId, meeting_id: meetingId },
    })
    if (!schedule) throw new NotFoundException(`Host schedule #${scheduleId} not found`)

    return schedule
  }

  private assertCanManage(meeting: Meeting, userId: number, isPrivileged: boolean): void {
    if (isPrivileged) return
    if (meeting.host_id !== userId) {
      throw new ForbiddenException('Only the meeting owner or an admin can manage host schedules')
    }
  }
}
