import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { google } from 'googleapis'
import type { EmployeeRequest } from '@/modules/employee_requests/entities/employee_request.entity'
import { ErrorLogsService } from '@/modules/error_logs/error_logs.service'
import {
  EmployeeRequestType,
  LeaveType,
  OvertimeType,
} from '@/modules/employee_requests/entities/employee_request.entity'

@Injectable()
export class GoogleCalendarService {
  private readonly logger = new Logger(GoogleCalendarService.name)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private calendar: any | null = null

  constructor(
    private readonly configService: ConfigService,
    private readonly errorLogsService: ErrorLogsService,
  ) {
    this.initialize()
  }

  private initialize(): void {
    const keyFile = this.configService.get<string>('GOOGLE_SHEETS_KEY_FILE')
    const credentialsJson = this.configService.get<string>('GOOGLE_SHEETS_CREDENTIALS')

    if (!keyFile && !credentialsJson) {
      this.logger.warn(
        'Google Calendar integration disabled: set GOOGLE_SHEETS_KEY_FILE or GOOGLE_SHEETS_CREDENTIALS',
      )
      return
    }

    try {
      const authOptions = keyFile
        ? { keyFile, scopes: ['https://www.googleapis.com/auth/calendar'] }
        : {
            credentials: JSON.parse(credentialsJson!) as object,
            scopes: ['https://www.googleapis.com/auth/calendar'],
          }

      const auth = new google.auth.GoogleAuth(authOptions)
      this.calendar = google.calendar({ version: 'v3', auth })
    } catch (error) {
      this.logger.error('Failed to initialize Google Calendar client', error)
      this.errorLogsService.logError({
        message: 'Failed to initialize Google Calendar client',
        stackTrace: (error as Error).stack ?? null,
        path: 'google_calendar',
      })
    }
  }

  isReady(): boolean {
    return this.calendar !== null
  }

  private leaveTypeLabel(type: LeaveType): string {
    const labels: Record<LeaveType, string> = {
      [LeaveType.PAID_LEAVE]: 'Paid Leave',
      [LeaveType.UNPAID_LEAVE]: 'Unpaid Leave',
      [LeaveType.WOMAN_LEAVE]: 'Woman Leave',
      [LeaveType.MARRIAGE_LEAVE]: 'Marriage Leave',
      [LeaveType.MATERNITY_LEAVE]: 'Maternity Leave',
      [LeaveType.PATERNITY_LEAVE]: 'Paternity Leave',
      [LeaveType.COMPASSIONATE_LEAVE]: 'Compassionate Leave',
    }
    return labels[type] ?? type
  }

  private overtimeTypeLabel(type: OvertimeType): string {
    const labels: Record<OvertimeType, string> = {
      [OvertimeType.WEEKDAY]: 'Weekday',
      [OvertimeType.WEEKEND]: 'Weekend',
      [OvertimeType.PUBLIC_HOLIDAY]: 'Public Holiday',
    }
    return labels[type] ?? type
  }

  private buildEventSummary(request: EmployeeRequest): string {
    const userName = request.user?.full_name ?? request.user?.email ?? `User #${request.user_id}`
    switch (request.type) {
      case EmployeeRequestType.WFH:
        return `[WFH] ${userName}`
      case EmployeeRequestType.OFF:
        return `[OFF${request.leave_type ? ` - ${this.leaveTypeLabel(request.leave_type)}` : ''}] ${userName}`
      case EmployeeRequestType.OVERTIME:
        return `[Overtime${request.overtime_type ? ` - ${this.overtimeTypeLabel(request.overtime_type)}` : ''}] ${userName}`
      case EmployeeRequestType.EQUIPMENT:
        return `[Equipment] ${userName}`
      case EmployeeRequestType.CLOCK_FORGET:
        return `[Clock Forget] ${userName}`
      default:
        return `[Request] ${userName}`
    }
  }

  /**
   * Formats a date value as a naive local datetime string (no timezone suffix)
   * so that Google Calendar interprets it using the provided timeZone field.
   * Example: "2026-03-26T08:00:00"
   */
  private toLocalDateTimeString(value: Date | string): string {
    const date = new Date(value)
    // Format as YYYY-MM-DDTHH:mm:ss without Z suffix
    const pad = (number_: number) => String(number_).padStart(2, '0')
    return (
      `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
      `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
    )
  }

  private buildEventTimes(request: EmployeeRequest): {
    start: Record<string, string>
    end: Record<string, string>
  } {
    if (request.from_datetime && request.to_datetime) {
      return {
        start: {
          dateTime: this.toLocalDateTimeString(request.from_datetime),
          timeZone: 'Asia/Ho_Chi_Minh',
        },
        end: {
          dateTime: this.toLocalDateTimeString(request.to_datetime),
          timeZone: 'Asia/Ho_Chi_Minh',
        },
      }
    }

    // Fallback: all-day event using forget_date or created_at
    const dateString =
      request.forget_date ??
      new Date(request.created_at ?? Date.now()).toISOString().substring(0, 10)
    return {
      start: { date: dateString },
      end: { date: dateString },
    }
  }

  /**
   * Creates a single Google Calendar event for the given employee request.
   * Returns the created event ID, or null if creation fails.
   */
  private async createSingleEvent(
    calendarId: string,
    summary: string,
    description: string,
    start: Record<string, string>,
    end: Record<string, string>,
    requestId: number,
  ): Promise<string | null> {
    try {
      const response = await this.calendar.events.insert({
        calendarId,
        requestBody: { summary, description, start, end },
      })
      return (response.data.id as string) ?? null
    } catch (error) {
      this.logger.error(`Failed to create calendar event for request #${requestId}`, error)
      this.errorLogsService.logError({
        message: `Failed to create calendar event for request #${requestId}`,
        stackTrace: (error as Error).stack ?? null,
        path: 'google_calendar',
      })
      return null
    }
  }

  /**
   * Creates Google Calendar event(s) for the given employee request.
   * - Single day: one event using from_datetime → to_datetime.
   * - Multi-day range: one event per weekday (Mon–Fri) in the range,
   *   using the same start/end time as from/to_datetime respectively.
   *   Saturday and Sunday are skipped.
   * Returns comma-separated event IDs, or null if none were created.
   */
  async createEvents(request: EmployeeRequest, calendarId: string): Promise<string | null> {
    if (!this.calendar) return null

    if (!request.from_datetime || !request.to_datetime) {
      // Fallback: single all-day event
      const { start, end } = this.buildEventTimes(request)
      this.logger.log(
        `[CALENDAR] request #${request.id} fallback start=${JSON.stringify(start)} end=${JSON.stringify(end)}`,
      )
      return this.createSingleEvent(
        calendarId,
        this.buildEventSummary(request),
        request.reason ?? '',
        start,
        end,
        request.id,
      )
    }

    const fromDate = new Date(request.from_datetime)
    const toDate = new Date(request.to_datetime)
    const pad = (number: number) => String(number).padStart(2, '0')
    const startTimeString = `T${pad(fromDate.getHours())}:${pad(fromDate.getMinutes())}:00`
    const endTimeString = `T${pad(toDate.getHours())}:${pad(toDate.getMinutes())}:00`
    const summary = this.buildEventSummary(request)
    const description = request.reason ?? ''

    // Iterate from start date to end date, skipping weekends
    const current = new Date(fromDate)
    current.setHours(0, 0, 0, 0)
    const endDay = new Date(toDate)
    endDay.setHours(0, 0, 0, 0)

    const eventIds: string[] = []

    while (current <= endDay) {
      const dayOfWeek = current.getDay() // 0=Sunday, 6=Saturday
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        const dateString = `${current.getFullYear()}-${pad(current.getMonth() + 1)}-${pad(current.getDate())}`
        const start = { dateTime: `${dateString}${startTimeString}`, timeZone: 'Asia/Ho_Chi_Minh' }
        const end = { dateTime: `${dateString}${endTimeString}`, timeZone: 'Asia/Ho_Chi_Minh' }
        this.logger.log(`[CALENDAR] request #${request.id} creating event for ${dateString}`)
        const eventId = await this.createSingleEvent(
          calendarId,
          summary,
          description,
          start,
          end,
          request.id,
        )
        if (eventId) eventIds.push(eventId)
      }
      current.setDate(current.getDate() + 1)
    }

    return eventIds.length > 0 ? eventIds.join(',') : null
  }

  /**
   * Deletes all Google Calendar events stored in a comma-separated event ID string.
   * calendarId is the company's own Google Calendar ID.
   * Silently logs errors — does not throw.
   */
  async deleteEvents(calendarId: string, eventIdsCsv: string): Promise<void> {
    if (!this.calendar) return

    const eventIds = eventIdsCsv
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
    for (const eventId of eventIds) {
      try {
        await this.calendar.events.delete({ calendarId, eventId })
      } catch (error) {
        this.logger.error(`Failed to delete calendar event ${eventId}`, error)
        this.errorLogsService.logError({
          message: `Failed to delete calendar event ${eventId}`,
          stackTrace: (error as Error).stack ?? null,
          path: 'google_calendar',
        })
      }
    }
  }
}
