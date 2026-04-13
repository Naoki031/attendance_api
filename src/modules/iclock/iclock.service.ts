import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import * as momentTimezone from 'moment-timezone'
import { User } from '@/modules/users/entities/user.entity'
import { AttendanceLogsService } from '@/modules/attendance_logs/attendance_logs.service'
import { SlackChannelsService } from '@/modules/slack_channels/slack_channels.service'
import { ErrorLogsService } from '@/modules/error_logs/error_logs.service'

export interface AttlogRecord {
  pin: number
  date: string
  time: string
  status: number
}

export interface ProcessResult {
  total: number
  saved: number
  skipped: number
}

@Injectable()
export class IclockService {
  private readonly logger = new Logger(IclockService.name)

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly attendanceLogsService: AttendanceLogsService,
    private readonly slackChannelsService: SlackChannelsService,
    private readonly errorLogsService: ErrorLogsService,
  ) {}

  /**
   * Returns current datetime string in Vietnam timezone for heartbeat response.
   * Uses moment-timezone to avoid manual UTC offset arithmetic.
   */
  getCurrentVnDatetime(timezone = 'Asia/Ho_Chi_Minh'): string {
    return momentTimezone.tz(Date.now(), timezone).format('YYYY-MM-DD HH:mm:ss')
  }

  /**
   * Parses raw ATTLOG body text from ZKTeco device.
   * Each line format: PIN\tDate Time\tStatus\tVerify\tWorkCode\tReserved
   * Status: 0=check-in, 1=check-out, 4=overtime-in, 5=overtime-out
   */
  parseAttlog(body: string): AttlogRecord[] {
    const records: AttlogRecord[] = []
    const lines = body.split(/\r?\n/).filter((line) => line.trim())

    for (const line of lines) {
      const parts = line.split('\t')
      if (parts.length < 2) continue

      const pin = parseInt(parts[0].trim(), 10)
      const dateTime = parts[1]?.trim() ?? ''
      const status = parseInt(parts[2]?.trim() ?? '0', 10)

      if (isNaN(pin) || !dateTime) continue

      const spaceIndex = dateTime.indexOf(' ')
      if (spaceIndex === -1) continue

      const date = dateTime.substring(0, spaceIndex)
      const time = dateTime.substring(spaceIndex + 1)

      if (!date || !time) continue

      records.push({ pin, date, time, status })
    }

    return records
  }

  /**
   * Processes parsed ATTLOG records: maps device PIN to system user via device_user_id,
   * then upserts attendance logs.
   * - Status 0, 4 = clock-in
   * - Status 1, 5 = clock-out
   * - Others = treated as clock-in (first punch of the day)
   */
  async processAttlog(records: AttlogRecord[]): Promise<ProcessResult> {
    const result: ProcessResult = { total: records.length, saved: 0, skipped: 0 }

    if (records.length === 0) return result

    const users = await this.userRepository.find({
      select: ['id', 'device_user_id'] as (keyof User)[],
      where: { is_activated: true },
    })

    const deviceToUser = new Map<number, number>()
    for (const user of users) {
      if (user.device_user_id != null) {
        deviceToUser.set(user.device_user_id, user.id)
      }
    }

    for (const record of records) {
      const userId = deviceToUser.get(record.pin)

      if (!userId) {
        this.logger.warn(`[ICLOCK] PIN=${record.pin} not mapped to any user — skipped`)
        result.skipped++
        continue
      }

      try {
        const isClockOut = record.status === 1 || record.status === 5
        const clockIn = isClockOut ? null : record.time
        const clockOut = isClockOut ? record.time : null

        await this.attendanceLogsService.upsert(userId, record.date, clockIn, clockOut)

        this.logger.log(
          `[ICLOCK] PIN=${record.pin} → userId=${userId} | ${record.date} ${record.time} | status=${record.status}`,
        )
        result.saved++
      } catch (error) {
        this.logger.error(`[ICLOCK] Failed to save record for PIN=${record.pin}`, error)
        this.errorLogsService.logError({
          message: `Failed to save attendance record for PIN=${record.pin} date=${record.date}`,
          stackTrace: (error as Error).stack ?? null,
          path: 'iclock',
        })
        this.slackChannelsService.sendSystemError(
          `[ICLOCK] Failed to save attendance record for PIN=${record.pin} date=${record.date}: ${(error as Error).message}`,
        )
        result.skipped++
      }
    }

    return result
  }
}
