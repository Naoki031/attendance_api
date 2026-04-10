import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import * as moment from 'moment'
import { MeetingHostSchedule, HostScheduleType } from './entities/meeting_host_schedule.entity'
import { Meeting } from './entities/meeting.entity'
import { CreateHostScheduleDto } from './dto/create-host-schedule.dto'
import { UpdateHostScheduleDto } from './dto/update-host-schedule.dto'
import { SwapDatesDto } from './dto/swap-dates.dto'

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

    await this.assertNoDuplicateDates(meeting.id, dto)

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

    await this.assertNoDuplicateDates(meeting.id, schedule, schedule.id)

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
  async resolveHostForDate(meetingId: number, date: string): Promise<number | null> {
    const meeting = await this.meetingRepository.findOne({ where: { id: meetingId } })
    if (!meeting) throw new NotFoundException(`Meeting #${meetingId} not found`)

    const schedules = await this.scheduleRepository.find({
      where: { meeting_id: meetingId, is_active: true },
    })

    const matching = schedules.filter((schedule) => this.matchesDate(schedule, date))

    if (matching.length === 0) return null

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
  async resolveHostForDateByUuid(meetingUuid: string, date: string): Promise<number | null> {
    const meeting = await this.findMeetingByUuid(meetingUuid)

    return this.resolveHostForDate(meeting.id, date)
  }

  /**
   * Excludes a single date from a schedule so that date is no longer covered.
   * For one_time schedules whose only date matches, the record is deleted entirely.
   */
  async excludeDate(
    scheduleId: number,
    meetingUuid: string,
    requestUserId: number,
    date: string,
    isPrivileged = false,
  ): Promise<void> {
    this.assertDateNotPast(date)
    const meeting = await this.findMeetingByUuid(meetingUuid)
    this.assertCanManage(meeting, requestUserId, isPrivileged)

    const schedule = await this.findScheduleById(scheduleId, meeting.id)

    // For one_time: just delete — excluding the only date leaves an empty record
    if (schedule.schedule_type === HostScheduleType.ONE_TIME) {
      await this.scheduleRepository.remove(schedule)
      return
    }

    // For date_list: remove the specific date from the array
    if (schedule.schedule_type === HostScheduleType.DATE_LIST) {
      const updated = (schedule.dates ?? []).filter((dateItem) => dateItem !== date)
      if (updated.length === 0) {
        await this.scheduleRepository.remove(schedule)
        return
      }
      await this.scheduleRepository.update({ id: schedule.id }, { dates: updated })
      return
    }

    // For date_range / recurring: add to excluded_dates
    const excluded = [...(schedule.excluded_dates ?? []), date]
    await this.scheduleRepository.update({ id: schedule.id }, { excluded_dates: excluded })
  }

  /**
   * Truncates a schedule so it no longer covers the given date or any date after it.
   * The schedule is deleted if it would cover no dates after truncation.
   */
  async truncateFromDate(
    scheduleId: number,
    meetingUuid: string,
    requestUserId: number,
    date: string,
    isPrivileged = false,
  ): Promise<void> {
    this.assertDateNotPast(date)
    const meeting = await this.findMeetingByUuid(meetingUuid)
    this.assertCanManage(meeting, requestUserId, isPrivileged)

    const schedule = await this.findScheduleById(scheduleId, meeting.id)
    const dayBefore = moment(date).subtract(1, 'day').format('YYYY-MM-DD')

    switch (schedule.schedule_type) {
      case HostScheduleType.ONE_TIME:
        // The one date is being removed — delete the record
        await this.scheduleRepository.remove(schedule)
        return

      case HostScheduleType.DATE_LIST: {
        const remaining = (schedule.dates ?? []).filter((dateItem) => dateItem < date)
        if (remaining.length === 0) {
          await this.scheduleRepository.remove(schedule)
          return
        }
        await this.scheduleRepository.update({ id: schedule.id }, { dates: remaining })
        return
      }

      case HostScheduleType.DATE_RANGE:
        if (!schedule.date_from || dayBefore < schedule.date_from) {
          // Entire range is removed
          await this.scheduleRepository.remove(schedule)
          return
        }
        await this.scheduleRepository.update({ id: schedule.id }, { date_to: dayBefore })
        return

      case HostScheduleType.RECURRING:
        await this.scheduleRepository.update({ id: schedule.id }, { recur_end_date: dayBefore })
        return
    }
  }

  /**
   * Swaps the hosts of two dates atomically.
   * Finds who is scheduled on each date, excludes those dates from their
   * existing schedules, then creates new one_time entries with the hosts swapped.
   */
  async swapDates(
    meetingUuid: string,
    requestUserId: number,
    dto: SwapDatesDto,
    isPrivileged = false,
  ): Promise<void> {
    const meeting = await this.findMeetingByUuid(meetingUuid)
    this.assertCanManage(meeting, requestUserId, isPrivileged)

    if (dto.date_a === dto.date_b) {
      throw new BadRequestException('Cannot swap a date with itself')
    }

    const resolvedA = await this.resolveScheduleForDate(meeting.id, dto.date_a)
    const resolvedB = await this.resolveScheduleForDate(meeting.id, dto.date_b)

    if (!resolvedA) {
      throw new BadRequestException(`No host scheduled on ${dto.date_a}`)
    }
    if (!resolvedB) {
      throw new BadRequestException(`No host scheduled on ${dto.date_b}`)
    }
    if (resolvedA.userId === resolvedB.userId) {
      throw new BadRequestException('Both dates are hosted by the same person — nothing to swap')
    }

    // Step 1: exclude each date from its current schedule
    const excludedA = [...(resolvedA.schedule.excluded_dates ?? []), dto.date_a]
    const excludedB = [...(resolvedB.schedule.excluded_dates ?? []), dto.date_b]

    await Promise.all([
      resolvedA.schedule.schedule_type === HostScheduleType.ONE_TIME
        ? this.scheduleRepository.remove(resolvedA.schedule)
        : this.scheduleRepository.update(
            { id: resolvedA.schedule.id },
            { excluded_dates: excludedA },
          ),
      resolvedB.schedule.schedule_type === HostScheduleType.ONE_TIME
        ? this.scheduleRepository.remove(resolvedB.schedule)
        : this.scheduleRepository.update(
            { id: resolvedB.schedule.id },
            { excluded_dates: excludedB },
          ),
    ])

    // Step 2: create new one_time entries with swapped hosts
    await this.scheduleRepository.save([
      this.scheduleRepository.create({
        meeting_id: meeting.id,
        user_id: resolvedB.userId, // host B now covers date A
        schedule_type: HostScheduleType.ONE_TIME,
        date: dto.date_a,
        is_active: true,
      }),
      this.scheduleRepository.create({
        meeting_id: meeting.id,
        user_id: resolvedA.userId, // host A now covers date B
        schedule_type: HostScheduleType.ONE_TIME,
        date: dto.date_b,
        is_active: true,
      }),
    ])
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private matchesDate(schedule: MeetingHostSchedule, dateString: string): boolean {
    if ((schedule.excluded_dates ?? []).includes(dateString)) return false

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

  /**
   * Throws ConflictException if any date produced by the incoming schedule
   * is already covered by another active schedule of the same meeting.
   * Pass excludeId when updating so the schedule being edited is not checked against itself.
   */
  private async assertNoDuplicateDates(
    meetingId: number,
    incoming: {
      schedule_type: HostScheduleType
      date?: string | null
      dates?: string[] | null
      date_from?: string | null
      date_to?: string | null
      day_of_week?: number | null
      interval_weeks?: number | null
      recur_start_date?: string | null
      recur_end_date?: string | null
    },
    excludeId?: number,
  ): Promise<void> {
    const existing = await this.scheduleRepository.find({
      where: { meeting_id: meetingId, is_active: true },
    })

    const others = existing.filter((schedule) => schedule.id !== excludeId)
    if (others.length === 0) return

    const incomingDates = this.generateDates(incoming)
    if (incomingDates.length === 0) return

    for (const dateString of incomingDates) {
      const conflict = others.find((schedule) => this.matchesDate(schedule, dateString))
      if (conflict) {
        throw new ConflictException(
          `Date ${dateString} is already covered by another host schedule`,
        )
      }
    }
  }

  /**
   * Expands a schedule definition into a list of concrete date strings (YYYY-MM-DD).
   * For recurring schedules, generates occurrences up to 2 years from recur_start_date.
   */
  private generateDates(schedule: {
    schedule_type: HostScheduleType
    date?: string | null
    dates?: string[] | null
    date_from?: string | null
    date_to?: string | null
    day_of_week?: number | null
    interval_weeks?: number | null
    recur_start_date?: string | null
    recur_end_date?: string | null
  }): string[] {
    switch (schedule.schedule_type) {
      case HostScheduleType.ONE_TIME:
        return schedule.date ? [schedule.date] : []

      case HostScheduleType.DATE_LIST:
        return (schedule.dates ?? []).filter(Boolean) as string[]

      case HostScheduleType.DATE_RANGE: {
        if (!schedule.date_from || !schedule.date_to) return []
        const result: string[] = []
        const current = new Date(schedule.date_from + 'T00:00:00Z')
        const end = new Date(schedule.date_to + 'T00:00:00Z')
        while (current <= end) {
          result.push(current.toISOString().slice(0, 10))
          current.setUTCDate(current.getUTCDate() + 1)
        }
        return result
      }

      case HostScheduleType.RECURRING: {
        if (
          schedule.day_of_week === undefined ||
          schedule.day_of_week === null ||
          !schedule.interval_weeks ||
          !schedule.recur_start_date
        ) {
          return []
        }
        const result: string[] = []
        const anchor = new Date(schedule.recur_start_date + 'T00:00:00Z')
        const daysUntilFirst = (schedule.day_of_week - anchor.getUTCDay() + 7) % 7
        const current = new Date(anchor)
        current.setUTCDate(current.getUTCDate() + daysUntilFirst)

        const twoYearsLater = new Date(anchor)
        twoYearsLater.setUTCFullYear(twoYearsLater.getUTCFullYear() + 2)
        const endDate = schedule.recur_end_date
          ? new Date(schedule.recur_end_date + 'T00:00:00Z')
          : twoYearsLater
        const cap = endDate < twoYearsLater ? endDate : twoYearsLater

        while (current <= cap) {
          result.push(current.toISOString().slice(0, 10))
          current.setUTCDate(current.getUTCDate() + schedule.interval_weeks * 7)
        }
        return result
      }

      default:
        return []
    }
  }

  /** Throws BadRequestException if the given date is strictly in the past (before today). */
  private assertDateNotPast(date: string): void {
    const today = moment(new Date()).format('YYYY-MM-DD')
    if (date < today) {
      throw new BadRequestException(`Cannot modify a past date: ${date}`)
    }
  }

  /**
   * Returns the best-matching active schedule and resolved userId for a given date.
   * Returns null if no schedule covers the date.
   */
  private async resolveScheduleForDate(
    meetingId: number,
    date: string,
  ): Promise<{ schedule: MeetingHostSchedule; userId: number } | null> {
    const schedules = await this.scheduleRepository.find({
      where: { meeting_id: meetingId, is_active: true },
    })

    const matching = schedules.filter((schedule) => this.matchesDate(schedule, date))
    if (matching.length === 0) return null

    matching.sort((scheduleA, scheduleB) => {
      const priorityDiff =
        SCHEDULE_TYPE_PRIORITY[scheduleB.schedule_type] -
        SCHEDULE_TYPE_PRIORITY[scheduleA.schedule_type]
      if (priorityDiff !== 0) return priorityDiff
      return scheduleB.created_at.getTime() - scheduleA.created_at.getTime()
    })

    const winner = matching[0]!
    return { schedule: winner, userId: winner.user_id }
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
