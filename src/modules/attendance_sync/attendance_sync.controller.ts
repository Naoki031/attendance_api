import { Controller, Get, Post, UseGuards } from '@nestjs/common'
import { AttendanceSyncService } from './attendance_sync.service'
import { ZkDeviceService } from './zk-device.service'
import { PermissionsGuard } from '@/modules/permissions/guards/permissions.guard'
import { Permissions } from '@/modules/permissions/decorators/permissions.decorator'

@Controller('attendance-sync')
@UseGuards(PermissionsGuard)
export class AttendanceSyncController {
  constructor(
    private readonly attendanceSyncService: AttendanceSyncService,
    private readonly zkDeviceService: ZkDeviceService,
  ) {}

  /**
   * Tests the connection to the ZKTeco device and returns diagnostic info:
   * connected status, device time, enrolled user count, stored record count.
   */
  @Get('device-info')
  @Permissions('read')
  getDeviceInfo() {
    return this.zkDeviceService.getDeviceInfo()
  }

  /**
   * Dry-run preview: fetches data from device and returns a structured log
   * showing which device users are mapped/unmapped and what would be saved.
   * Does NOT write to the database.
   */
  @Get('preview')
  @Permissions('read')
  preview() {
    return this.attendanceSyncService.preview()
  }

  /**
   * Manually triggers a full sync from the ZKTeco device to the database.
   * Returns a summary of the sync result.
   */
  @Post('trigger')
  @Permissions('create')
  trigger() {
    return this.attendanceSyncService.sync()
  }
}
