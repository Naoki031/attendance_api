import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, In, LessThanOrEqual, MoreThanOrEqual, IsNull, Or } from 'typeorm'
import { Cron, CronExpression } from '@nestjs/schedule'
import { ConfigService } from '@nestjs/config'
import * as moment from 'moment-timezone'
import { User } from '@/modules/users/entities/user.entity'
import {
  EmployeeRequest,
  EmployeeRequestStatus,
  EmployeeRequestType,
} from '@/modules/employee_requests/entities/employee_request.entity'
import { AttendanceLog } from './entities/attendance_log.entity'
import { UserDepartment } from '@/modules/user_departments/entities/user_department.entity'
import { Company } from '@/modules/companies/entities/company.entity'
import { UserWorkSchedule } from '@/modules/user_work_schedules/entities/user_work_schedule.entity'
import { MailService } from '@/modules/mail/mail.service'

/** Default timezone when company/country timezone is unavailable */
const DEFAULT_TIMEZONE = 'Asia/Ho_Chi_Minh'

@Injectable()
export class AttendanceReminderService {
  private readonly logger = new Logger(AttendanceReminderService.name)
  private isRunning = false

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(AttendanceLog)
    private readonly attendanceLogRepository: Repository<AttendanceLog>,
    @InjectRepository(EmployeeRequest)
    private readonly employeeRequestRepository: Repository<EmployeeRequest>,
    @InjectRepository(UserDepartment)
    private readonly userDepartmentRepository: Repository<UserDepartment>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @InjectRepository(UserWorkSchedule)
    private readonly userWorkScheduleRepository: Repository<UserWorkSchedule>,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleCronReminders(): Promise<void> {
    if (this.isRunning) return
    this.isRunning = true

    try {
      await this.checkClockInReminders()
      await this.checkClockOutReminders()
    } finally {
      this.isRunning = false
    }
  }

  private async checkClockInReminders(): Promise<void> {
    // 1. Batch load all active users
    const activeUsers = await this.userRepository.find({
      where: { is_activated: true, skip_attendance: false },
      select: ['id', 'email', 'first_name', 'last_name'],
    })
    if (!activeUsers.length) return

    const userIds = activeUsers.map((user) => user.id)

    // 2. Batch load context data
    const { userCompanyMap, companyMap, scheduleMap } = await this.loadBatchContext(userIds)

    // 3. Group timezones → unique "today" dates
    const allTodayDates = this.buildUniqueTodayDates(userCompanyMap, companyMap)

    // 4. Batch load today's attendance logs
    const clockInMap = await this.loadClockInMap(userIds, allTodayDates)

    // 5. Batch load approved OFF requests overlapping today
    const leaveUserIds = await this.loadApprovedLeaveUserIds(userIds, allTodayDates)

    // 6. Process each user
    const clientUrl = this.configService.get<string>('CLIENT_URL', 'http://localhost')

    for (const user of activeUsers) {
      try {
        if (leaveUserIds.has(user.id)) continue

        const companyId = userCompanyMap.get(user.id)
        const company = companyId ? companyMap.get(companyId) : undefined
        const timezone = company?.country?.timezone ?? DEFAULT_TIMEZONE

        const now = moment.tz(timezone)
        const date = now.format('YYYY-MM-DD')
        const currentTimeHHmm = now.format('HH:mm')

        // Skip weekends
        if (now.day() === 0 || now.day() === 6) continue

        // Resolve schedule: custom first, then company default
        const customSchedule = scheduleMap.get(user.id)
        const scheduledStart = customSchedule?.start_time ?? company?.work_start_time ?? null
        if (!scheduledStart) continue

        // Clock-in reminder: scheduledStart - 10min, not yet clocked in
        const reminderTime = this.subtractMinutes(scheduledStart, 10)
        if (!reminderTime || currentTimeHHmm !== reminderTime) continue

        const hasClockedIn = clockInMap.get(`${user.id}_${date}`)
        if (hasClockedIn) continue

        const userName = `${user.first_name} ${user.last_name}`
        this.sendClockInReminder(user.email, userName, scheduledStart, clientUrl, companyId ?? null)
      } catch (error) {
        this.logger.error(
          `[REMINDER] Clock-in check failed for userId=${user.id}: ${(error as Error).message}`,
        )
      }
    }
  }

  private async checkClockOutReminders(): Promise<void> {
    const activeUsers = await this.userRepository.find({
      where: { is_activated: true, skip_attendance: false },
      select: ['id', 'email', 'first_name', 'last_name'],
    })
    if (!activeUsers.length) return

    const userIds = activeUsers.map((user) => user.id)

    const { userCompanyMap, companyMap, scheduleMap } = await this.loadBatchContext(userIds)

    const allTodayDates = this.buildUniqueTodayDates(userCompanyMap, companyMap)

    // Batch load today's attendance logs (both clock_in and clock_out)
    const todayLogs = allTodayDates.length
      ? await this.attendanceLogRepository.find({
          where: allTodayDates.map((date) => ({
            date,
            user_id: In(userIds),
          })),
          select: ['user_id', 'date', 'clock_in', 'clock_out'],
        })
      : []
    const clockOutMap = new Map<string, boolean>()
    const clockedInMap = new Map<string, boolean>()
    for (const log of todayLogs) {
      const key = `${log.user_id}_${log.date}`
      if (log.clock_out) clockOutMap.set(key, true)
      if (log.clock_in) clockedInMap.set(key, true)
    }

    const clientUrl = this.configService.get<string>('CLIENT_URL', 'http://localhost')

    for (const user of activeUsers) {
      try {
        const companyId = userCompanyMap.get(user.id)
        const company = companyId ? companyMap.get(companyId) : undefined
        const timezone = company?.country?.timezone ?? DEFAULT_TIMEZONE

        const now = moment.tz(timezone)
        const date = now.format('YYYY-MM-DD')
        const currentTimeHHmm = now.format('HH:mm')

        if (now.day() === 0 || now.day() === 6) continue

        const customSchedule = scheduleMap.get(user.id)
        const scheduledEnd = customSchedule?.end_time ?? company?.work_end_time ?? null
        if (!scheduledEnd) continue

        // Clock-out reminder: scheduledEnd + 10min, not yet clocked out, already clocked in
        const reminderTime = this.addMinutes(scheduledEnd, 10)
        if (!reminderTime || currentTimeHHmm !== reminderTime) continue

        const key = `${user.id}_${date}`
        if (!clockedInMap.get(key) || clockOutMap.get(key)) continue

        const userName = `${user.first_name} ${user.last_name}`
        this.sendClockOutReminder(user.email, userName, scheduledEnd, clientUrl, companyId ?? null)
      } catch (error) {
        this.logger.error(
          `[REMINDER] Clock-out check failed for userId=${user.id}: ${(error as Error).message}`,
        )
      }
    }
  }

  /**
   * Batch loads context data shared between clock-in and clock-out checks.
   */
  private async loadBatchContext(userIds: number[]): Promise<{
    userCompanyMap: Map<number, number>
    companyMap: Map<number, Company>
    scheduleMap: Map<number, { start_time: string; end_time: string }>
  }> {
    // User departments → company mapping
    const userDepartments = await this.userDepartmentRepository.find({
      where: { user_id: In(userIds) },
      select: ['user_id', 'company_id'],
    })
    const userCompanyMap = new Map<number, number>()
    for (const ud of userDepartments) {
      userCompanyMap.set(ud.user_id, ud.company_id)
    }

    // Companies with country relation (for timezone)
    const companyIds = [...new Set(userCompanyMap.values())]
    const companies = companyIds.length
      ? await this.companyRepository.find({
          where: { id: In(companyIds) },
          relations: ['country'],
        })
      : []
    const companyMap = new Map(companies.map((company) => [company.id, company]))

    // Compute the widest date range across all company timezones
    // This ensures schedules are loaded regardless of timezone differences
    const timezoneDates = [...companyMap.values()].map((company) =>
      moment.tz(company.country?.timezone ?? DEFAULT_TIMEZONE).format('YYYY-MM-DD'),
    )
    const minDate = timezoneDates.length
      ? timezoneDates.sort()[0]
      : moment.tz(DEFAULT_TIMEZONE).format('YYYY-MM-DD')
    const maxDate = timezoneDates.length ? timezoneDates.sort()[timezoneDates.length - 1] : minDate

    const customSchedules = await this.userWorkScheduleRepository.find({
      where: {
        user_id: In(userIds),
        effective_from: LessThanOrEqual(maxDate),
        effective_to: Or(IsNull(), MoreThanOrEqual(minDate)),
      },
    })
    const scheduleMap = new Map<number, { start_time: string; end_time: string }>()
    for (const schedule of customSchedules) {
      if (!scheduleMap.has(schedule.user_id)) {
        scheduleMap.set(schedule.user_id, {
          start_time: schedule.start_time,
          end_time: schedule.end_time,
        })
      }
    }

    return { userCompanyMap, companyMap, scheduleMap }
  }

  /**
   * Returns the set of unique "today" date strings across all user timezones.
   */
  private buildUniqueTodayDates(
    userCompanyMap: Map<number, number>,
    companyMap: Map<number, Company>,
  ): string[] {
    const timezoneSet = new Set<string>()
    for (const [, companyId] of userCompanyMap) {
      const company = companyMap.get(companyId)
      timezoneSet.add(company?.country?.timezone ?? DEFAULT_TIMEZONE)
    }
    return [...timezoneSet].map((tz) => moment.tz(tz).format('YYYY-MM-DD'))
  }

  /**
   * Batch loads today's attendance logs and returns a map of "userId_date" → hasClockedIn.
   */
  private async loadClockInMap(
    userIds: number[],
    allTodayDates: string[],
  ): Promise<Map<string, boolean>> {
    const todayLogs = allTodayDates.length
      ? await this.attendanceLogRepository.find({
          where: allTodayDates.map((date) => ({
            date,
            user_id: In(userIds),
          })),
          select: ['user_id', 'date', 'clock_in'],
        })
      : []

    const clockInMap = new Map<string, boolean>()
    for (const log of todayLogs) {
      if (log.clock_in) clockInMap.set(`${log.user_id}_${log.date}`, true)
    }
    return clockInMap
  }

  /**
   * Batch loads user IDs that have approved OFF requests covering any of today's dates.
   */
  private async loadApprovedLeaveUserIds(
    userIds: number[],
    allTodayDates: string[],
  ): Promise<Set<number>> {
    if (!userIds.length || !allTodayDates.length) return new Set()

    const approvedLeaveRequests = await this.employeeRequestRepository
      .createQueryBuilder('request')
      .where('request.user_id IN (:...userIds)', { userIds })
      .andWhere('request.type = :type', { type: EmployeeRequestType.OFF })
      .andWhere('request.status = :status', { status: EmployeeRequestStatus.APPROVED })
      .andWhere('request.from_datetime <= :endRange', {
        endRange: moment.tz(DEFAULT_TIMEZONE).add(1, 'day').endOf('day').toDate(),
      })
      .andWhere('(request.to_datetime IS NULL OR request.to_datetime >= :startRange)', {
        startRange: moment.tz(DEFAULT_TIMEZONE).startOf('day').toDate(),
      })
      .select(['request.user_id', 'request.from_datetime', 'request.to_datetime'])
      .getMany()

    const leaveUserIds = new Set<number>()
    for (const request of approvedLeaveRequests) {
      const fromDate = request.from_datetime
        ? moment.tz(request.from_datetime, 'UTC').format('YYYY-MM-DD')
        : ''
      const toDate = request.to_datetime
        ? moment.tz(request.to_datetime, 'UTC').format('YYYY-MM-DD')
        : fromDate
      for (const date of allTodayDates) {
        if (fromDate <= date && date <= toDate) {
          leaveUserIds.add(request.user_id)
          break
        }
      }
    }
    return leaveUserIds
  }

  private sendClockInReminder(
    email: string,
    userName: string,
    scheduledTime: string,
    clockUrl: string,
    companyId: number | null,
  ): void {
    this.mailService
      .sendTemplate(
        'clock_in_reminder',
        email,
        {
          user_name: userName,
          scheduled_time: scheduledTime.substring(0, 5),
          clock_url: clockUrl,
        },
        companyId ?? undefined,
      )
      .catch((error) => {
        this.logger.error(
          `[REMINDER] clock_in email failed for ${email}: ${(error as Error).message}`,
        )
      })
  }

  private sendClockOutReminder(
    email: string,
    userName: string,
    scheduledTime: string,
    clockUrl: string,
    companyId: number | null,
  ): void {
    this.mailService
      .sendTemplate(
        'clock_out_reminder',
        email,
        {
          user_name: userName,
          scheduled_time: scheduledTime.substring(0, 5),
          clock_url: clockUrl,
        },
        companyId ?? undefined,
      )
      .catch((error) => {
        this.logger.error(
          `[REMINDER] clock_out email failed for ${email}: ${(error as Error).message}`,
        )
      })
  }

  /**
   * Subtracts minutes from a "HH:mm:ss" time string and returns "HH:mm".
   * Returns empty string if the result would wrap past midnight.
   */
  private subtractMinutes(timeHHmmss: string, minutes: number): string {
    const [hours, mins] = timeHHmmss.split(':').map(Number)
    const totalMinutes = hours * 60 + mins - minutes
    if (totalMinutes < 0) return ''
    const resultHours = Math.floor(totalMinutes / 60)
    const resultMins = totalMinutes % 60
    return `${String(resultHours).padStart(2, '0')}:${String(resultMins).padStart(2, '0')}`
  }

  /**
   * Adds minutes to a "HH:mm:ss" time string and returns "HH:mm".
   * Returns empty string if the result would wrap past midnight.
   */
  private addMinutes(timeHHmmss: string, minutes: number): string {
    const [hours, mins] = timeHHmmss.split(':').map(Number)
    const totalMinutes = hours * 60 + mins + minutes
    if (totalMinutes >= 1440) return ''
    const resultHours = Math.floor(totalMinutes / 60)
    const resultMins = totalMinutes % 60
    return `${String(resultHours).padStart(2, '0')}:${String(resultMins).padStart(2, '0')}`
  }
}
