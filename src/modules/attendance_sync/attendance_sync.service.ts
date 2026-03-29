import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ConfigService } from '@nestjs/config'
import { Cron, CronExpression } from '@nestjs/schedule'
import * as momentTimezone from 'moment-timezone'
import { User } from '@/modules/users/entities/user.entity'
import { AttendanceLogsService } from '@/modules/attendance_logs/attendance_logs.service'
import { SlackChannelsService } from '@/modules/slack_channels/slack_channels.service'
import { ZkDeviceService } from './zk-device.service'

const DEFAULT_TIMEZONE = 'Asia/Ho_Chi_Minh'

export interface SyncResult {
  fetched: number
  saved: number
  skipped: number
  errors: number
}

export interface PreviewRecord {
  deviceUserId: number
  systemUserId: number | null
  userEmail: string | null
  userName: string | null
  status: 'matched' | 'unmatched'
  date: string
  clockIn: string | null
  clockOut: string | null
  punchCount: number
  allPunches: string[]
}

export interface PreviewResult {
  deviceIp: string
  fetched: number
  matched: number
  unmatched: number
  unmappedDeviceUserIds: number[]
  records: PreviewRecord[]
}

@Injectable()
export class AttendanceSyncService {
  private readonly logger = new Logger(AttendanceSyncService.name)

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly zkDeviceService: ZkDeviceService,
    private readonly attendanceLogsService: AttendanceLogsService,
    private readonly slackChannelsService: SlackChannelsService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Extracts date (YYYY-MM-DD) and time (HH:mm:ss) from a device timestamp in the given timezone.
   *
   * node-zklib decodes device timestamps using new Date(year, month, day, hour, minute, second) —
   * a local-time constructor. In a UTC container the Date's UTC fields hold the device's local
   * time values directly, so we reconstruct a moment-timezone object from those raw UTC fields
   * in the target timezone without any manual numeric offset.
   */
  private extractDeviceLocalTime(
    deviceDate: Date,
    timezone: string,
  ): { date: string; time: string } {
    const localMoment = momentTimezone.tz(
      {
        year: deviceDate.getUTCFullYear(),
        month: deviceDate.getUTCMonth(),
        date: deviceDate.getUTCDate(),
        hour: deviceDate.getUTCHours(),
        minute: deviceDate.getUTCMinutes(),
        second: deviceDate.getUTCSeconds(),
      },
      timezone,
    )
    return {
      date: localMoment.format('YYYY-MM-DD'),
      time: localMoment.format('HH:mm:ss'),
    }
  }

  /**
   * Returns the configured sync start date (ZK_SYNC_FROM_DATE env var).
   * Records before this date are ignored during sync and preview.
   */
  private getSyncFromDate(): string | null {
    return this.configService.get<string>('ZK_SYNC_FROM_DATE') ?? null
  }

  /**
   * Builds the device_user_id → { user, timezone } map for all active users.
   * Timezone is resolved from: user → user_departments[0] → company → country → timezone.
   * Falls back to DEFAULT_TIMEZONE if not set.
   */
  private async buildUserMap(): Promise<Map<number, { user: User; timezone: string }>> {
    const users = await this.userRepository.find({
      select: ['id', 'email', 'first_name', 'last_name', 'device_user_id'] as (keyof User)[],
      where: { is_activated: true, skip_attendance: false },
      relations: [
        'user_departments',
        'user_departments.company',
        'user_departments.company.country',
      ],
    })
    const deviceToUser = new Map<number, { user: User; timezone: string }>()
    for (const user of users) {
      if (user.device_user_id == null) continue
      const timezone = user.user_departments?.[0]?.company?.country?.timezone ?? DEFAULT_TIMEZONE
      deviceToUser.set(user.device_user_id, { user, timezone })
    }
    return deviceToUser
  }

  /**
   * Dry-run: fetches data from device and returns a structured preview log
   * without writing anything to the database.
   */
  async preview(): Promise<PreviewResult> {
    const deviceIp = process.env.ZK_DEVICE_IP ?? '—'
    const rawRecords = await this.zkDeviceService.fetchAttendance()
    const deviceToUser = await this.buildUserMap()
    const fromDate = this.getSyncFromDate()

    // Group by deviceUserId + date → collect punches
    const grouped = new Map<
      string,
      {
        deviceUserId: number
        date: string
        times: string[]
        user: User | null
      }
    >()

    for (const record of rawRecords) {
      const entry = deviceToUser.get(record.deviceUserId)
      const timezone = entry?.timezone ?? DEFAULT_TIMEZONE
      const { date, time: timeString } = this.extractDeviceLocalTime(record.timestamp, timezone)

      // Skip records before the configured sync start date
      if (fromDate && date < fromDate) continue
      const key = `${record.deviceUserId}:${date}`
      const user = entry?.user ?? null

      if (!grouped.has(key)) {
        grouped.set(key, { deviceUserId: record.deviceUserId, date, times: [], user })
      }
      grouped.get(key)!.times.push(timeString)
    }

    const records: PreviewRecord[] = []
    const unmappedSet = new Set<number>()

    for (const { deviceUserId, date, times, user } of grouped.values()) {
      const sortedTimes = [...times].sort()
      const clockIn = sortedTimes[0] ?? null
      const clockOut = sortedTimes.length > 1 ? sortedTimes[sortedTimes.length - 1] : null

      if (!user) unmappedSet.add(deviceUserId)

      records.push({
        deviceUserId,
        systemUserId: user?.id ?? null,
        userEmail: user?.email ?? null,
        userName: user ? `${user.first_name} ${user.last_name}` : null,
        status: user ? 'matched' : 'unmatched',
        date,
        clockIn,
        clockOut,
        punchCount: times.length,
        allPunches: sortedTimes,
      })
    }

    // Sort: unmatched first, then by date desc, then by deviceUserId
    records.sort((recordA, recordB) => {
      if (recordA.status !== recordB.status) {
        return recordA.status === 'unmatched' ? -1 : 1
      }
      if (recordA.date !== recordB.date) return recordB.date.localeCompare(recordA.date)
      return recordA.deviceUserId - recordB.deviceUserId
    })

    const matched = records.filter((record) => record.status === 'matched').length

    return {
      deviceIp,
      fetched: rawRecords.length,
      matched,
      unmatched: unmappedSet.size,
      unmappedDeviceUserIds: Array.from(unmappedSet).sort((numberA, numberB) => numberA - numberB),
      records,
    }
  }

  /**
   * Full sync flow:
   * 1. Fetch raw attendance records from ZKTeco device
   * 2. Map device user IDs to system users via device_user_id field
   * 3. Group punches by user + date (using company's country timezone) → derive clock_in / clock_out
   * 4. Upsert attendance_logs records
   */
  async sync(): Promise<SyncResult> {
    const result: SyncResult = { fetched: 0, saved: 0, skipped: 0, errors: 0 }

    const rawRecords = await this.zkDeviceService.fetchAttendance()
    result.fetched = rawRecords.length

    if (rawRecords.length === 0) return result

    const deviceToUser = await this.buildUserMap()
    const fromDate = this.getSyncFromDate()

    // Group by systemUserId + date → collect all punch times
    const grouped = new Map<string, { userId: number; date: string; times: string[] }>()

    for (const record of rawRecords) {
      const entry = deviceToUser.get(record.deviceUserId)
      if (!entry) {
        result.skipped++
        continue
      }

      const { date, time: timeString } = this.extractDeviceLocalTime(
        record.timestamp,
        entry.timezone,
      )

      // Skip records before the configured sync start date
      if (fromDate && date < fromDate) {
        result.skipped++
        continue
      }

      const key = `${entry.user.id}:${date}`

      if (!grouped.has(key)) {
        grouped.set(key, { userId: entry.user.id, date, times: [] })
      }
      grouped.get(key)!.times.push(timeString)
    }

    // Upsert one log per user per day
    for (const { userId, date, times } of grouped.values()) {
      try {
        const sortedTimes = [...times].sort()
        const clockIn = sortedTimes[0]
        const clockOut = sortedTimes.length > 1 ? sortedTimes[sortedTimes.length - 1] : null

        await this.attendanceLogsService.upsert(userId, date, clockIn, clockOut)
        result.saved++
      } catch (error) {
        this.logger.error(`Failed to upsert attendance log for user ${userId} on ${date}`, error)
        result.errors++
      }
    }

    this.logger.log(
      `Sync complete — fetched: ${result.fetched}, saved: ${result.saved}, skipped: ${result.skipped}, errors: ${result.errors}`,
    )
    return result
  }

  /**
   * Automatically syncs attendance data from ZKTeco device every minute.
   * Runs only if ZK_DEVICE_IP is configured.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async autoSync(): Promise<void> {
    if (this.configService.get<string>('ZK_AUTO_SYNC_ENABLED') !== 'true') return

    const deviceIp = this.configService.get<string>('ZK_DEVICE_IP')
    if (!deviceIp) return

    this.logger.log('[AUTO-SYNC] Starting scheduled attendance sync...')
    try {
      const result = await this.sync()
      this.logger.log(
        `[AUTO-SYNC] Done — fetched: ${result.fetched}, saved: ${result.saved}, skipped: ${result.skipped}, errors: ${result.errors}`,
      )
      if (result.errors > 0) {
        await this.slackChannelsService.sendSystemError(
          `[AUTO-SYNC] Attendance sync completed with ${result.errors} error(s). fetched: ${result.fetched}, saved: ${result.saved}, skipped: ${result.skipped}`,
        )
      }
    } catch (error) {
      this.logger.error('[AUTO-SYNC] Failed', error)
      await this.slackChannelsService.sendSystemError(
        `[AUTO-SYNC] Attendance sync failed: ${(error as Error).message}`,
      )
    }
  }
}
