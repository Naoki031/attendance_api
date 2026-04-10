import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Between, IsNull, LessThanOrEqual, Or, Repository } from 'typeorm'
import * as crypto from 'crypto'
import * as momentTimezone from 'moment-timezone'
import { Cron } from '@nestjs/schedule'
import { ConfigService } from '@nestjs/config'
import { AttendanceLog, ScheduleType } from './entities/attendance_log.entity'
import { AttendanceLogEdit } from './entities/attendance_log_edit.entity'
import { AdminEditAttendanceLogDto } from './dto/admin-edit-attendance-log.dto'
import {
  EmployeeRequest,
  EmployeeRequestType,
  EmployeeRequestStatus,
  ClockType,
} from '@/modules/employee_requests/entities/employee_request.entity'
import { UserDepartment } from '@/modules/user_departments/entities/user_department.entity'
import { Company } from '@/modules/companies/entities/company.entity'
import { User } from '@/modules/users/entities/user.entity'
import { UserWorkSchedule } from '@/modules/user_work_schedules/entities/user_work_schedule.entity'
import { GoogleSheetsService } from '@/modules/google_sheets/google_sheets.service'
import type { ColumnConfigItem } from '@/modules/google_sheets/entities/company_google_sheet.entity'
import { FaceService } from '@/modules/face/face.service'
import { StorageService } from '@/modules/storage/storage.service'
import { SlackChannelsService } from '@/modules/slack_channels/slack_channels.service'
import { isSuperAdmin } from '@/common/utils/is-privileged.utility'

export interface FaceCheckinResult {
  success: boolean
  type: 'clock_in' | 'clock_out'
  employeeName: string
  employeeCode: string
  confidence: number
  imageUrl: string
  checkedAt: string
}

export interface TodayStatusResponse {
  date: string
  clockIn: string | null
  clockOut: string | null
  isWfhToday: boolean
}

export interface TodayQrResponse {
  token: string
  date: string
  companyId: number
}

/** request_type value used to look up Google Sheets config for attendance logs */
const ATTENDANCE_SHEET_REQUEST_TYPE = 'attendance_log'

/** Default column layout for attendance log exports */
const DEFAULT_ATTENDANCE_LOG_COLUMN_CONFIG: ColumnConfigItem[] = [
  { column: 'A', field: 'id', header: 'User ID' },
  { column: 'B', field: 'user.device_user_id', header: 'Device ID' },
  { column: 'C', field: 'user.full_name', header: 'Full Name' },
  { column: 'D', field: 'user.email', header: 'Email' },
  { column: 'E', field: 'user.position', header: 'Position' },
  { column: 'F', field: 'date', header: 'Work Date' },
  { column: 'G', field: 'schedule_type', header: 'Schedule Type' },
  { column: 'H', field: 'scheduled_start', header: 'Schedule Start' },
  { column: 'I', field: 'scheduled_end', header: 'Schedule End' },
  { column: 'J', field: 'clock_in', header: 'Clock In' },
  { column: 'K', field: 'clock_out', header: 'Clock Out' },
  { column: 'L', field: 'attendance_count', header: 'Count' },
]

@Injectable()
export class AttendanceLogsService {
  private readonly logger = new Logger(AttendanceLogsService.name)

  constructor(
    @InjectRepository(AttendanceLog)
    private readonly attendanceLogRepository: Repository<AttendanceLog>,
    @InjectRepository(EmployeeRequest)
    private readonly employeeRequestRepository: Repository<EmployeeRequest>,
    @InjectRepository(UserDepartment)
    private readonly userDepartmentRepository: Repository<UserDepartment>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserWorkSchedule)
    private readonly userWorkScheduleRepository: Repository<UserWorkSchedule>,
    @InjectRepository(AttendanceLogEdit)
    private readonly attendanceLogEditRepository: Repository<AttendanceLogEdit>,
    private readonly googleSheetsService: GoogleSheetsService,
    private readonly configService: ConfigService,
    private readonly faceService: FaceService,
    private readonly storageService: StorageService,
    private readonly slackChannelsService: SlackChannelsService,
  ) {}

  // ─── Helpers ──────────────────────────────────────────────────────────────

  /**
   * Returns the current date and time in Vietnam timezone (UTC+7).
   */
  private getVnDateTime(): { date: string; time: string } {
    const vnNow = new Date(Date.now() + 7 * 60 * 60 * 1000)
    const date = vnNow.toISOString().substring(0, 10)
    const time = vnNow.toISOString().substring(11, 19)
    return { date, time }
  }

  /**
   * Returns current date and time in the timezone of the company the user belongs to.
   * Falls back to Vietnam timezone (UTC+7) if no timezone is configured.
   */
  private async getDateTimeForUser(userId: number): Promise<{ date: string; time: string }> {
    const companyId = await this.getUserCompanyId(userId)

    if (companyId) {
      const company = await this.companyRepository.findOne({
        where: { id: companyId },
        relations: ['country'],
      })
      const timezone = company?.country?.timezone

      if (timezone) {
        const now = momentTimezone.tz(Date.now(), timezone)

        return { date: now.format('YYYY-MM-DD'), time: now.format('HH:mm:ss') }
      }
    }

    return this.getVnDateTime()
  }

  /**
   * Checks if the user has an approved WFH request covering today.
   * WFH/OFF requests exclude weekends (Saturdays and Sundays).
   * OT requests can include weekends, so they are checked separately.
   */
  private async checkIsWfhToday(userId: number, today: string): Promise<boolean> {
    // Permanent remote users can always clock in/out manually — no QR needed
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['permanent_remote'],
    })

    if (user?.permanent_remote) {
      return true
    }

    const dayOfWeek = new Date(today).getDay()

    // Check OT requests first (can include Saturdays and Sundays)
    const otRequests = await this.employeeRequestRepository.find({
      where: [
        {
          user_id: userId,
          type: EmployeeRequestType.OVERTIME,
          status: EmployeeRequestStatus.APPROVED,
        },
      ],
    })
    const hasOtToday = otRequests.some((request) => {
      const fromDate = request.from_datetime
        ? new Date(request.from_datetime).toISOString().substring(0, 10)
        : ''
      const toDate = request.to_datetime
        ? new Date(request.to_datetime).toISOString().substring(0, 10)
        : fromDate
      return fromDate <= today && today <= toDate
    })

    // If has OT today (including weekends), show attendance section
    if (hasOtToday) {
      return true
    }

    // Weekend (Saturday or Sunday) without OT - no work obligation
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return false
    }

    // Check WFH (approved or pending) and BUSINESS_TRIP (approved only) for weekdays
    const remoteRequests = await this.employeeRequestRepository.find({
      where: [
        { user_id: userId, type: EmployeeRequestType.WFH, status: EmployeeRequestStatus.APPROVED },
        { user_id: userId, type: EmployeeRequestType.WFH, status: EmployeeRequestStatus.PENDING },
        {
          user_id: userId,
          type: EmployeeRequestType.BUSINESS_TRIP,
          status: EmployeeRequestStatus.APPROVED,
        },
      ],
    })

    return remoteRequests.some((request) => {
      const fromDate = request.from_datetime
        ? new Date(request.from_datetime).toISOString().substring(0, 10)
        : ''
      const toDate = request.to_datetime
        ? new Date(request.to_datetime).toISOString().substring(0, 10)
        : fromDate

      return fromDate <= today && today <= toDate
    })
  }

  /**
   * Checks whether the given user has the Super Admin role by looking up their
   * permission groups from the database (not from the JWT, which may be stale).
   */
  async isUserSuperAdmin(userId: number): Promise<boolean> {
    const userGroupPermissions = await this.userRepository
      .createQueryBuilder('user')
      .innerJoin('user.user_group_permissions', 'ugp')
      .innerJoin('ugp.permission_group', 'pg')
      .select('pg.name', 'name')
      .where('user.id = :userId', { userId })
      .getRawMany<{ name: string }>()

    return userGroupPermissions.some(({ name }) => {
      const normalized = name.toLowerCase().replace(/[\s_]+/g, '')

      return normalized === 'superadmin' || normalized === 'super'
    })
  }

  /**
   * Returns the company ID for the given user, or null if not found.
   */
  async getUserCompanyId(userId: number): Promise<number | null> {
    const userDepartment = await this.userDepartmentRepository.findOne({
      where: { user_id: userId },
      select: ['company_id'],
    })

    return userDepartment?.company_id ?? null
  }

  /**
   * Checks whether the given IP is in the allowed list.
   */
  private isIpAllowed(clientIp: string, allowedIps: string): boolean {
    // Normalize IPv6-mapped IPv4 addresses (e.g. "::ffff:192.168.1.1" → "192.168.1.1")
    const normalizedIp = clientIp.startsWith('::ffff:') ? clientIp.slice(7) : clientIp
    const list = allowedIps
      .split(',')
      .map((ip) => ip.trim())
      .filter(Boolean)

    return list.some((allowed) => normalizedIp === allowed || normalizedIp.startsWith(allowed))
  }

  /**
   * Generates an HMAC-SHA256 daily token for QR clock-in/out.
   */
  private generateDailyToken(companyId: number, date: string): string {
    const secret = this.configService.get<string>('QR_SECRET') ?? 'default-qr-secret'

    return crypto
      .createHmac('sha256', secret)
      .update(`${companyId}:${date}`)
      .digest('hex')
      .slice(0, 32)
  }

  /**
   * Resolves the effective work schedule for a user on a given date.
   * Returns custom schedule if one is active, otherwise falls back to company default.
   */
  private async resolveSchedule(
    userId: number,
    date: string,
  ): Promise<{
    scheduledStart: string | null
    scheduledEnd: string | null
    scheduleType: ScheduleType | null
  }> {
    // 1. Check for active custom schedule
    const customSchedules = await this.userWorkScheduleRepository.find({
      where: {
        user_id: userId,
        effective_from: LessThanOrEqual(date),
        effective_to: Or(IsNull(), LessThanOrEqual('9999-12-31')),
      },
      order: { effective_from: 'DESC' },
    })
    const activeCustom = customSchedules.find(
      (schedule) => !schedule.effective_to || schedule.effective_to >= date,
    )

    if (activeCustom) {
      return {
        scheduledStart: activeCustom.start_time,
        scheduledEnd: activeCustom.end_time,
        scheduleType: ScheduleType.CUSTOM,
      }
    }

    // 2. Fall back to company default
    const companyId = await this.getUserCompanyId(userId)

    if (companyId) {
      const company = await this.companyRepository.findOne({
        where: { id: companyId },
        select: ['work_start_time', 'work_end_time'],
      })
      if (company?.work_start_time || company?.work_end_time) {
        return {
          scheduledStart: company.work_start_time ?? null,
          scheduledEnd: company.work_end_time ?? null,
          scheduleType: ScheduleType.COMPANY,
        }
      }
    }

    return { scheduledStart: null, scheduledEnd: null, scheduleType: null }
  }

  /**
   * Minimum minutes after clock-in before a new scan is treated as clock-out.
   * Scans within this window are treated as duplicate clock-ins (earliest time wins).
   */
  private static readonly CLOCK_OUT_MIN_GAP_MINUTES = 30

  /** Converts "HH:mm:ss" to total minutes from midnight. */
  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number)

    return (hours ?? 0) * 60 + (minutes ?? 0)
  }

  /**
   * Determines clock-in or clock-out based on existing record and records the time.
   * A new scan within CLOCK_OUT_MIN_GAP_MINUTES of clock-in is treated as a duplicate
   * clock-in (earliest time wins) to prevent accidental clock-outs from repeated scans.
   */
  private async clockForUser(
    userId: number,
    date: string,
    time: string,
  ): Promise<{ log: AttendanceLog; action: 'clock_in' | 'clock_out' }> {
    const existing = await this.attendanceLogRepository.findOne({
      where: { user_id: userId, date },
    })

    if (!existing || !existing.clock_in) {
      const log = await this.upsert(userId, date, time, null)
      return { log, action: 'clock_in' }
    }

    const minutesSinceClockIn = this.timeToMinutes(time) - this.timeToMinutes(existing.clock_in)

    if (minutesSinceClockIn < AttendanceLogsService.CLOCK_OUT_MIN_GAP_MINUTES) {
      const log = await this.upsert(userId, date, time, null)

      return { log, action: 'clock_in' }
    }

    const log = await this.upsert(userId, date, null, time)
    return { log, action: 'clock_out' }
  }

  // ─── Public API methods ────────────────────────────────────────────────────

  /**
   * Upserts an attendance log for a given user + date.
   * Updates clock_in if earlier than stored, clock_out if later.
   * Also populates schedule fields and attendance_count.
   */
  async upsert(
    userId: number,
    date: string,
    clockIn?: string | null,
    clockOut?: string | null,
  ): Promise<AttendanceLog> {
    const existing = await this.attendanceLogRepository.findOne({
      where: { user_id: userId, date },
    })

    const { scheduledStart, scheduledEnd, scheduleType } = await this.resolveSchedule(userId, date)

    if (existing) {
      const shouldUpdateClockIn = clockIn && (!existing.clock_in || clockIn < existing.clock_in)
      const shouldUpdateClockOut =
        clockOut && (!existing.clock_out || clockOut > existing.clock_out)

      const newClockIn = shouldUpdateClockIn ? clockIn : existing.clock_in
      const newClockOut = shouldUpdateClockOut ? clockOut : existing.clock_out
      const newCount = newClockIn || newClockOut ? 1 : 0

      if (shouldUpdateClockIn || shouldUpdateClockOut) {
        await this.attendanceLogRepository.update(
          { id: existing.id },
          {
            ...(shouldUpdateClockIn ? { clock_in: clockIn } : {}),
            ...(shouldUpdateClockOut ? { clock_out: clockOut } : {}),
            scheduled_start: scheduledStart,
            scheduled_end: scheduledEnd,
            schedule_type: scheduleType,
            attendance_count: newCount,
          },
        )

        return this.attendanceLogRepository.findOne({
          where: { id: existing.id },
        }) as Promise<AttendanceLog>
      }

      // Update schedule fields and correct attendance_count if inconsistent
      const needsScheduleUpdate =
        existing.scheduled_start !== scheduledStart ||
        existing.scheduled_end !== scheduledEnd ||
        existing.schedule_type !== scheduleType
      const needsCountFix = existing.attendance_count !== newCount

      if (needsScheduleUpdate || needsCountFix) {
        await this.attendanceLogRepository.update(
          { id: existing.id },
          {
            scheduled_start: scheduledStart,
            scheduled_end: scheduledEnd,
            schedule_type: scheduleType,
            attendance_count: newCount,
          },
        )
      }

      return existing
    }

    const hasClockEvent = !!(clockIn || clockOut)

    return this.attendanceLogRepository.save({
      user_id: userId,
      date,
      clock_in: clockIn ?? null,
      clock_out: clockOut ?? null,
      scheduled_start: scheduledStart,
      scheduled_end: scheduledEnd,
      schedule_type: scheduleType,
      attendance_count: hasClockEvent ? 1 : 0,
    })
  }

  /**
   * Returns today's attendance status and WFH flag for the given user.
   */
  async getTodayStatus(userId: number): Promise<TodayStatusResponse> {
    const { date } = this.getVnDateTime()
    const [log, isWfhToday] = await Promise.all([
      this.attendanceLogRepository.findOne({ where: { user_id: userId, date } }),
      this.checkIsWfhToday(userId, date),
    ])
    return {
      date,
      clockIn: log?.clock_in ?? null,
      clockOut: log?.clock_out ?? null,
      isWfhToday,
    }
  }

  /**
   * Records a manual clock-in for WFH users.
   */
  async clockIn(userId: number): Promise<AttendanceLog> {
    const { date, time } = this.getVnDateTime()
    const isWfh = await this.checkIsWfhToday(userId, date)
    if (!isWfh) {
      throw new ForbiddenException('You do not have an approved WFH request for today')
    }

    const existing = await this.attendanceLogRepository.findOne({
      where: { user_id: userId, date },
    })
    if (existing?.clock_in) {
      throw new BadRequestException('You have already clocked in today')
    }

    return this.upsert(userId, date, time, null)
  }

  /**
   * Records a manual clock-out for WFH users.
   */
  async clockOut(userId: number): Promise<AttendanceLog> {
    const { date, time } = this.getVnDateTime()
    const existing = await this.attendanceLogRepository.findOne({
      where: { user_id: userId, date },
    })
    if (!existing?.clock_in) {
      throw new BadRequestException('You must clock in before clocking out')
    }

    return this.upsert(userId, date, null, time)
  }

  /**
   * Returns today's QR token for the admin's company.
   */
  async getTodayQr(adminUserId: number): Promise<TodayQrResponse> {
    const companyId = await this.getUserCompanyId(adminUserId)
    if (!companyId) {
      throw new NotFoundException('Company not found for this user')
    }
    const { date } = this.getVnDateTime()
    const token = this.generateDailyToken(companyId, date)
    return { token, date, companyId }
  }

  /**
   * Processes a QR-based clock-in/out.
   */
  async clockByQr(
    token: string,
    date: string,
    companyId: number,
    userId: number,
    clientIp: string,
  ): Promise<{ log: AttendanceLog; action: 'clock_in' | 'clock_out' }> {
    const { date: today, time } = this.getVnDateTime()

    if (date !== today) {
      throw new BadRequestException("QR code has expired — please scan today's QR code")
    }

    const expectedToken = this.generateDailyToken(companyId, date)
    if (token !== expectedToken) {
      throw new BadRequestException('Invalid QR code')
    }

    const company = await this.companyRepository.findOne({ where: { id: companyId } })
    if (!company) {
      throw new NotFoundException('Company not found')
    }
    if (!company.allowed_ips) {
      throw new ForbiddenException('No IP whitelist configured for this company')
    }
    if (!this.isIpAllowed(clientIp, company.allowed_ips)) {
      throw new ForbiddenException(
        `Clock-in not allowed from IP: ${clientIp.startsWith('::ffff:') ? clientIp.slice(7) : clientIp}`,
      )
    }

    return this.clockForUser(userId, today, time)
  }

  /**
   * Updates clock_in or clock_out on an existing attendance log directly.
   * Used when a CLOCK_FORGET employee request is approved.
   */
  async applyClockForget(
    userId: number,
    date: string,
    clockType: ClockType,
    time: string,
  ): Promise<void> {
    if (clockType === ClockType.CLOCK_IN) {
      await this.upsert(userId, date, time, null)
    } else {
      await this.upsert(userId, date, null, time)
    }
  }

  /**
   * Retrieves attendance logs for a user within a date range.
   */
  findByUser(userId: number, from: string, to: string): Promise<AttendanceLog[]> {
    return this.attendanceLogRepository.find({
      where: { user_id: userId, date: Between(from, to) },
      order: { date: 'DESC' },
    })
  }

  /**
   * Retrieves the current user's attendance logs for a given month.
   * Month format: YYYY-MM. Defaults to the current month if not provided.
   */
  findMyLogs(userId: number, month: string): Promise<AttendanceLog[]> {
    const from = `${month}-01`
    const lastDay = new Date(
      parseInt(month.substring(0, 4)),
      parseInt(month.substring(5, 7)),
      0,
    ).getDate()
    const to = `${month}-${String(lastDay).padStart(2, '0')}`

    return this.attendanceLogRepository.find({
      where: { user_id: userId, date: Between(from, to) },
      order: { date: 'ASC' },
    })
  }

  /**
   * Retrieves attendance logs within a date range.
   * If companyId is provided, only returns logs for users belonging to that company.
   */
  async findAll(from: string, to: string, companyId?: number): Promise<AttendanceLog[]> {
    const queryBuilder = this.attendanceLogRepository
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.user', 'user')
      .where('log.date BETWEEN :from AND :to', { from, to })
      .orderBy('log.date', 'DESC')
      .addOrderBy('log.user_id', 'ASC')

    if (companyId) {
      queryBuilder.andWhere(
        'log.user_id IN (SELECT ud.user_id FROM user_departments ud WHERE ud.company_id = :companyId)',
        { companyId },
      )
    }

    return queryBuilder.getMany()
  }

  /**
   * Maps a field name from column_config to the corresponding value on an AttendanceLog.
   * When log is null (no attendance record for that day), user info and date are taken
   * from the fallback parameters; attendance-specific fields are returned as empty strings.
   */
  private getAttendanceLogFieldValue(
    log: AttendanceLog | null,
    field: string,
    fallbackUser?: User,
    fallbackDate?: string,
  ): string | number {
    const user = log?.user ?? fallbackUser
    switch (field) {
      case 'id':
        return user?.id ?? ''
      case 'user.device_user_id':
        return user?.device_user_id ?? ''
      case 'user.full_name':
        return user?.full_name ?? ''
      case 'user.email':
        return user?.email ?? ''
      case 'user.position':
        return user?.position ?? ''
      case 'date':
        return log?.date ?? fallbackDate ?? ''
      case 'scheduled_start':
        return log?.scheduled_start ?? ''
      case 'scheduled_end':
        return log?.scheduled_end ?? ''
      case 'schedule_type':
        return log?.schedule_type ?? ''
      case 'clock_in':
        return log?.clock_in ?? ''
      case 'clock_out':
        return log?.clock_out ?? ''
      case 'attendance_count':
        return log?.attendance_count ?? ''
      default:
        return ''
    }
  }

  /**
   * Exports attendance logs for a given month to Google Sheets.
   * Data is sorted by employee full name ascending, then by date ascending.
   * Uses request_type = 'attendance_log' config from company_google_sheets.
   */
  async exportToSheet(
    companyId: number,
    month: string,
  ): Promise<{ rows: number; spreadsheetUrl: string }> {
    // month format: YYYY-MM
    const startOfMonth = momentTimezone.utc(`${month}-01`, 'YYYY-MM-DD')
    const endOfMonth = startOfMonth.clone().endOf('month')
    const from = startOfMonth.format('YYYY-MM-DD')
    const to = endOfMonth.format('YYYY-MM-DD')

    // Generate all working days (Mon–Fri) in the month
    const workingDays: string[] = []
    const cursor = startOfMonth.clone()
    while (cursor.isSameOrBefore(endOfMonth, 'day')) {
      const dow = cursor.day() // 0 = Sun, 6 = Sat
      if (dow >= 1 && dow <= 5) workingDays.push(cursor.format('YYYY-MM-DD'))
      cursor.add(1, 'day')
    }

    // Fetch all existing attendance logs for the month in this company
    const logs = await this.attendanceLogRepository
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.user', 'user')
      .where('log.date BETWEEN :from AND :to', { from, to })
      .andWhere(
        'log.user_id IN (SELECT ud.user_id FROM user_departments ud WHERE ud.company_id = :companyId)',
        { companyId },
      )
      .getMany()

    // Fetch all employees in the company who require attendance tracking, sorted by name
    const users = await this.userRepository
      .createQueryBuilder('user')
      .innerJoin('user_departments', 'ud', 'ud.user_id = user.id AND ud.company_id = :companyId', {
        companyId,
      })
      .where('user.skip_attendance = :skip', { skip: false })
      .orderBy('user.first_name', 'ASC')
      .addOrderBy('user.last_name', 'ASC')
      .getMany()

    this.logger.log(
      `[EXPORT] company=${companyId} month=${month} → ${logs.length} logs, ${users.length} users, ${workingDays.length} working days`,
    )

    // Build log lookup: userId → date → log
    const logMap = new Map<number, Map<string, AttendanceLog>>()
    for (const log of logs) {
      if (!logMap.has(log.user_id)) logMap.set(log.user_id, new Map())
      logMap.get(log.user_id)!.set(log.date, log)
    }

    if (!this.googleSheetsService.isReady()) {
      throw new BadRequestException('Google Sheets integration is not configured')
    }

    const config = await this.googleSheetsService.getSheetConfig(
      companyId,
      ATTENDANCE_SHEET_REQUEST_TYPE,
      DEFAULT_ATTENDANCE_LOG_COLUMN_CONFIG,
    )
    if (!config) {
      throw new NotFoundException(
        `No Google Sheet configured for company ${companyId} with type "${ATTENDANCE_SHEET_REQUEST_TYPE}". ` +
          'Please add a Google Sheets config with request_type = "attendance_log".',
      )
    }

    const sortedColumns = config.columnConfig
      .slice()
      .sort((colA, colB) => colA.column.localeCompare(colB.column))

    this.logger.log(
      `[EXPORT] columns: ${sortedColumns.map((col) => `${col.column}=${col.field}`).join(', ')}`,
    )

    const headers = sortedColumns.map((col) => col.header)

    // Build rows: one row per user per working day (empty attendance fields if no log)
    const rows: (string | number)[][] = []
    for (const user of users) {
      const userLogMap = logMap.get(user.id) ?? new Map<string, AttendanceLog>()
      for (const day of workingDays) {
        const log = userLogMap.get(day) ?? null
        rows.push(
          sortedColumns.map((col) => this.getAttendanceLogFieldValue(log, col.field, user, day)),
        )
      }
    }

    try {
      await this.googleSheetsService.writeBulkData(config.spreadsheetId, config.sheetName, [
        headers,
        ...rows,
      ])
    } catch (error) {
      this.logger.error('Failed to export attendance logs to Google Sheets', error)
      this.slackChannelsService.sendSystemError(
        `[AttendanceLogs] Failed to export attendance logs to Google Sheets: ${(error as Error).message}`,
      )
      throw new BadRequestException('Failed to write to Google Sheets')
    }

    return {
      rows: rows.length,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${config.spreadsheetId}/edit`,
    }
  }

  // ─── Admin Edit ────────────────────────────────────────────────────────────

  /**
   * Allows an admin to manually adjust clock_in and/or clock_out for a log entry.
   * Records the change in attendance_log_edits for audit purposes.
   */
  async adminEdit(
    logId: number,
    dto: AdminEditAttendanceLogDto,
    adminUserId: number,
  ): Promise<AttendanceLog> {
    const log = await this.attendanceLogRepository.findOne({ where: { id: logId } })
    if (!log) throw new NotFoundException('Attendance log not found')

    const editRecord: Partial<AttendanceLogEdit> = {
      attendance_log_id: logId,
      admin_id: adminUserId,
      reason: dto.reason,
      old_clock_in: log.clock_in ?? null,
      old_clock_out: log.clock_out ?? null,
      new_clock_in: dto.clock_in !== undefined ? dto.clock_in : (log.clock_in ?? null),
      new_clock_out: dto.clock_out !== undefined ? dto.clock_out : (log.clock_out ?? null),
    }

    await this.attendanceLogEditRepository.save(editRecord)

    const updatePayload: Partial<AttendanceLog> = {}
    if (dto.clock_in !== undefined) updatePayload.clock_in = dto.clock_in
    if (dto.clock_out !== undefined) updatePayload.clock_out = dto.clock_out

    if (Object.keys(updatePayload).length > 0) {
      await this.attendanceLogRepository.update({ id: logId }, updatePayload)
    }

    return this.attendanceLogRepository.findOne({
      where: { id: logId },
      relations: ['user'],
    }) as Promise<AttendanceLog>
  }

  /**
   * Returns the edit history for a specific attendance log, newest first.
   * Each entry includes the admin who made the change.
   */
  getEditHistory(logId: number): Promise<AttendanceLogEdit[]> {
    return this.attendanceLogEditRepository.find({
      where: { attendance_log_id: logId },
      relations: ['admin'],
      order: { created_at: 'DESC' },
    })
  }

  // ─── Cron Jobs ─────────────────────────────────────────────────────────────

  /**
   * Runs at 22:00 Vietnam time (15:00 UTC) every weekday (Mon–Fri).
   * For all active users in companies, inserts an empty attendance log (count=0)
   * for any user who has no record today.
   */
  @Cron('0 15 * * 1-5')
  async autoFillAbsences(): Promise<void> {
    const { date } = this.getVnDateTime()

    this.logger.log(`[AUTO-FILL] Running absence fill for date: ${date}`)

    // Get all active users who belong to at least one company and are not skipped from attendance
    const userDepartments = await this.userDepartmentRepository
      .createQueryBuilder('ud')
      .select('ud.user_id', 'user_id')
      .innerJoin('users', 'u', 'u.id = ud.user_id')
      .where('u.skip_attendance = :skip', { skip: false })
      .getRawMany<{ user_id: number }>()

    const userIds = [...new Set(userDepartments.map((ud) => ud.user_id))]

    let filled = 0
    for (const userId of userIds) {
      const existing = await this.attendanceLogRepository.findOne({
        where: { user_id: userId, date },
      })
      if (!existing) {
        try {
          await this.upsert(userId, date, null, null)
          filled++
        } catch (error) {
          this.logger.error(`[AUTO-FILL] Failed to fill absence for user ${userId}`, error)
          this.slackChannelsService.sendSystemError(
            `[AttendanceLogs] Auto-fill absence failed for userId=${userId} date=${date}: ${(error as Error).message}`,
          )
        }
      }
    }

    this.logger.log(`[AUTO-FILL] Done — filled ${filled} absences for ${date}`)
  }

  // ─── Face recognition ────────────────────────────────────────────────────

  /**
   * Processes a face-based check-in or check-out.
   * Matches the descriptor against registered employees, uploads the photo,
   * determines clock direction (in/out), then persists the record.
   *
   * @param descriptor - 128-element face descriptor from face-api.js
   * @param imageFile  - Captured frame from the client camera
   * @param clientIp   - Client IP address
   * @param deviceInfo - Client User-Agent string
   * @param location   - Optional "lat,lng" string
   */
  async faceCheckin(
    descriptor: number[],
    imageFile: Express.Multer.File,
    clientIp: string,
    deviceInfo: string,
    _location?: string,
    requestingUserId?: number,
    requestingUserRoles?: string[],
  ): Promise<FaceCheckinResult> {
    const matchResult = await this.faceService.matchFace(descriptor)
    if (!matchResult) {
      throw new BadRequestException('Face not recognized. Please register your face or try again.')
    }

    // Only super-admin users can clock in/out other people (kiosk mode).
    // Regular employees and non-super admins must clock themselves only.
    if (
      !isSuperAdmin(requestingUserRoles) &&
      requestingUserId !== undefined &&
      matchResult.employeeId !== requestingUserId
    ) {
      throw new ForbiddenException(
        'You can only clock in/out yourself. Ask a super admin to set up a dedicated shared device.',
      )
    }

    const { date, time } = await this.getDateTimeForUser(matchResult.employeeId)

    // Enforce network security: IP must be in company whitelist OR user must have WFH/permanent remote
    const companyId = await this.getUserCompanyId(matchResult.employeeId)

    if (companyId) {
      const company = await this.companyRepository.findOne({ where: { id: companyId } })
      const ipAllowed = company?.allowed_ips && this.isIpAllowed(clientIp, company.allowed_ips)

      if (!ipAllowed) {
        const isRemoteAllowed = await this.checkIsWfhToday(matchResult.employeeId, date)

        if (!isRemoteAllowed) {
          const normalizedIp = clientIp.startsWith('::ffff:') ? clientIp.slice(7) : clientIp

          throw new ForbiddenException(
            `Clock-in not allowed from IP ${normalizedIp}. Device must be on the company network or you must have an approved WFH request.`,
          )
        }
      }
    }

    const imageUrl = await this.storageService.uploadImage(
      imageFile.buffer,
      'checkin',
      matchResult.employeeId,
    )
    const checkedAt = new Date()
    const { action } = await this.clockForUser(matchResult.employeeId, date, time)

    const logRecord = await this.attendanceLogRepository.findOne({
      where: { user_id: matchResult.employeeId, date },
    })

    if (logRecord) {
      await this.attendanceLogRepository.update(
        { id: logRecord.id },
        {
          checkin_image_url: imageUrl,
          confidence: matchResult.confidence,
          ip_address: clientIp,
          device_info: deviceInfo || null,
        },
      )
    }

    return {
      success: true,
      type: action,
      employeeName: matchResult.employeeName,
      employeeCode: matchResult.employeeCode,
      confidence: matchResult.confidence,
      imageUrl,
      checkedAt: checkedAt.toISOString(),
    }
  }

  /**
   * Returns attendance logs for a given date, including user info.
   */
  async getByDate(date: string): Promise<AttendanceLog[]> {
    return this.attendanceLogRepository.find({
      where: { date },
      relations: ['user'],
      order: { user_id: 'ASC' },
    })
  }

  /**
   * Returns today's attendance summary: total check-ins, check-outs, and active employee count.
   */
  async getTodayStats(): Promise<{ checkins: number; checkouts: number; totalEmployees: number }> {
    const { date } = this.getVnDateTime()
    const logs = await this.attendanceLogRepository.find({ where: { date } })
    const checkins = logs.filter((log) => log.clock_in).length
    const checkouts = logs.filter((log) => log.clock_out).length

    const totalEmployees = await this.userRepository.count({
      where: { is_activated: true, skip_attendance: false },
    })

    return { checkins, checkouts, totalEmployees }
  }
}
