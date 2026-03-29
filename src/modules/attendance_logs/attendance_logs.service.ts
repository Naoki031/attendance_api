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
   * Checks if the user has an approved WFH request covering today.
   * WFH/OFF requests exclude weekends (Saturdays and Sundays).
   * OT requests can include weekends, so they are checked separately.
   */
  private async checkIsWfhToday(userId: number, today: string): Promise<boolean> {
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

    // Check WFH/PENDING WFH for weekdays only (Monday-Friday)
    const wfhRequests = await this.employeeRequestRepository.find({
      where: [
        { user_id: userId, type: EmployeeRequestType.WFH, status: EmployeeRequestStatus.APPROVED },
        { user_id: userId, type: EmployeeRequestType.WFH, status: EmployeeRequestStatus.PENDING },
      ],
    })
    return wfhRequests.some((request) => {
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
   * Determines clock-in or clock-out based on existing record and records the time.
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
   */
  private getAttendanceLogFieldValue(log: AttendanceLog, field: string): string | number {
    switch (field) {
      case 'id':
        return log.user?.id ?? log.user_id
      case 'user.device_user_id':
        return log.user?.device_user_id ?? ''
      case 'user.full_name':
        return log.user?.full_name ?? ''
      case 'user.email':
        return log.user?.email ?? ''
      case 'user.position':
        return log.user?.position ?? ''
      case 'date':
        return log.date
      case 'scheduled_start':
        return log.scheduled_start ?? ''
      case 'scheduled_end':
        return log.scheduled_end ?? ''
      case 'schedule_type':
        return log.schedule_type ?? ''
      case 'clock_in':
        return log.clock_in ?? ''
      case 'clock_out':
        return log.clock_out ?? ''
      case 'attendance_count':
        return log.attendance_count
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
    const from = `${month}-01`
    const lastDay = new Date(
      parseInt(month.substring(0, 4)),
      parseInt(month.substring(5, 7)),
      0,
    ).getDate()
    const to = `${month}-${String(lastDay).padStart(2, '0')}`

    const logsQueryBuilder = this.attendanceLogRepository
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.user', 'user')
      .where('log.date BETWEEN :from AND :to', { from, to })
      .andWhere(
        'log.user_id IN (SELECT ud.user_id FROM user_departments ud WHERE ud.company_id = :companyId)',
        { companyId },
      )
      .orderBy('log.date', 'ASC')
      .addOrderBy('log.user_id', 'ASC')

    const logs = await logsQueryBuilder.getMany()

    this.logger.log(`[EXPORT] company=${companyId} month=${month} → ${logs.length} logs found`)

    // Sort by employee name then date
    logs.sort((logA, logB) => {
      const nameA = logA.user?.full_name ?? ''
      const nameB = logB.user?.full_name ?? ''
      if (nameA !== nameB) return nameA.localeCompare(nameB)
      return logA.date.localeCompare(logB.date)
    })

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

    // Use column_config headers if defined, otherwise use default order
    const sortedColumns = config.columnConfig
      .slice()
      .sort((colA, colB) => colA.column.localeCompare(colB.column))

    this.logger.log(
      `[EXPORT] columns: ${sortedColumns.map((col) => `${col.column}=${col.field}`).join(', ')}`,
    )

    const headers = sortedColumns.map((col) => col.header)

    // Build data rows using column_config field mapping
    const rows = logs.map((log) =>
      sortedColumns.map((col) => this.getAttendanceLogFieldValue(log, col.field)),
    )

    if (logs.length > 0) {
      this.logger.log(`[EXPORT] sample row[0]: ${JSON.stringify(rows[0])}`)
    }

    try {
      await this.googleSheetsService.writeBulkData(config.spreadsheetId, config.sheetName, [
        headers,
        ...rows,
      ])
    } catch (error) {
      this.logger.error('Failed to export attendance logs to Google Sheets', error)
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
        }
      }
    }

    this.logger.log(`[AUTO-FILL] Done — filled ${filled} absences for ${date}`)
  }
}
