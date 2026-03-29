import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ZKLib = require('node-zklib')

export interface DeviceAttendanceRecord {
  deviceUserId: number
  timestamp: Date
  /** 0 = check-in, 1 = check-out (some devices use different codes) */
  type: number
}

export interface DeviceInfo {
  connected: boolean
  ip: string
  port: number
  error: string | null
  deviceTime: string | null
  userCount: number | null
  attendanceCount: number | null
}

@Injectable()
export class ZkDeviceService {
  private readonly logger = new Logger(ZkDeviceService.name)

  constructor(private readonly configService: ConfigService) {}

  private getDeviceConfig(): { ip: string; port: number; timeout: number } {
    const ip = this.configService.get<string>('ZK_DEVICE_IP') ?? ''
    const port = parseInt(this.configService.get<string>('ZK_DEVICE_PORT') ?? '4370', 10)
    const timeout = parseInt(this.configService.get<string>('ZK_DEVICE_TIMEOUT') ?? '5000', 10)
    return { ip, port, timeout }
  }

  /**
   * Wraps a promise in a hard deadline so the API never hangs when the device is unreachable.
   */
  private withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs),
      ),
    ])
  }

  /**
   * Tests the connection to the ZKTeco device and returns diagnostic information:
   * number of enrolled users and number of stored attendance records.
   *
   * Note: createSocket() already handles TCP connect (with UDP fallback) internally.
   * node-zklib does not expose a separate connect() or getTime() method on ZKLib.
   */
  async getDeviceInfo(): Promise<DeviceInfo> {
    const { ip, port, timeout } = this.getDeviceConfig()

    if (!ip) {
      return {
        connected: false,
        ip: '',
        port,
        error: 'ZK_DEVICE_IP is not configured in .env',
        deviceTime: null,
        userCount: null,
        attendanceCount: null,
      }
    }

    const device = new ZKLib(ip, port, timeout, 4000)

    try {
      this.logger.log(`[DeviceInfo] Connecting to ${ip}:${port}`)
      // createSocket() establishes the connection (TCP with UDP fallback) — no separate connect() needed
      await this.withTimeout(device.createSocket(), timeout, 'createSocket')

      // Use getInfo() to read user count and log count without downloading all records
      let userCount: number | null = null
      let attendanceCount: number | null = null
      try {
        const info = (await this.withTimeout(device.getInfo(), timeout, 'getInfo')) as {
          userCounts: number
          logCounts: number
          logCapacity: number
        }
        userCount = info.userCounts ?? null
        attendanceCount = info.logCounts ?? null
      } catch {
        userCount = null
        attendanceCount = null
      }

      this.logger.log(`[DeviceInfo] Connected — users: ${userCount}, records: ${attendanceCount}`)

      return {
        connected: true,
        ip,
        port,
        error: null,
        deviceTime: null,
        userCount,
        attendanceCount,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.error(`[DeviceInfo] Failed to connect to ${ip}:${port} — ${message}`)
      return {
        connected: false,
        ip,
        port,
        error: message,
        deviceTime: null,
        userCount: null,
        attendanceCount: null,
      }
    } finally {
      try {
        await device.disconnect()
      } catch {
        // ignore
      }
    }
  }

  /**
   * Connects to the ZKTeco device, fetches all attendance records, then disconnects.
   * Returns [] if the device is unreachable or an error occurs.
   */
  async fetchAttendance(): Promise<DeviceAttendanceRecord[]> {
    const { ip, port, timeout } = this.getDeviceConfig()

    if (!ip) {
      this.logger.warn('ZK_DEVICE_IP not configured — skipping device sync')
      return []
    }

    const device = new ZKLib(ip, port, timeout, 4000)

    try {
      this.logger.log(`Connecting to ZKTeco device at ${ip}:${port} (timeout: ${timeout}ms)`)

      // createSocket() establishes the connection (TCP with UDP fallback) — no separate connect() needed
      await this.withTimeout(device.createSocket(), timeout, 'createSocket')

      const fetchResult = (await this.withTimeout(
        device.getAttendances(),
        30000,
        'getAttendances',
      )) as { data: { deviceUserId: number; recordTime: Date; type: number }[] }
      const records = fetchResult.data
      this.logger.log(`Fetched ${records?.length ?? 0} records from device`)

      return (records ?? []).map(
        (record: { deviceUserId: number; recordTime: Date; type: number }) => ({
          deviceUserId: Number(record.deviceUserId),
          timestamp: new Date(record.recordTime),
          type: record.type,
        }),
      )
    } catch (error) {
      this.logger.error(`Failed to fetch attendance from device ${ip}:${port}`, error)
      throw error
    } finally {
      try {
        await device.disconnect()
      } catch {
        // ignore
      }
    }
  }
}
