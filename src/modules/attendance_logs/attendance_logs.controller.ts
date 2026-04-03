import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Put,
  Body,
  Query,
  Param,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ValidationPipe,
  ParseIntPipe,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import { Request } from 'express'
import { IsString, IsNumber } from 'class-validator'
import { AttendanceLogsService } from './attendance_logs.service'
import { AdminEditAttendanceLogDto } from './dto/admin-edit-attendance-log.dto'
import { PermissionsGuard } from '@/modules/permissions/guards/permissions.guard'
import { Permissions } from '@/modules/permissions/decorators/permissions.decorator'
import { User } from '@/modules/auth/decorators/user.decorator'
import { User as UserEntity } from '@/modules/users/entities/user.entity'

class ClockQrDto {
  @IsString()
  token!: string

  @IsNumber()
  companyId!: number

  @IsString()
  date!: string
}

@Controller('attendance-logs')
@UseGuards(PermissionsGuard)
export class AttendanceLogsController {
  constructor(private readonly attendanceLogsService: AttendanceLogsService) {}

  /**
   * Lists attendance logs within a date range (admin view).
   * Query params: from (YYYY-MM-DD), to (YYYY-MM-DD), company_id (optional, super admin only)
   */
  @Get()
  @Permissions('read')
  async findAll(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('company_id') companyIdParameter: string,
    @User() user: UserEntity,
  ) {
    const today = new Date().toISOString().substring(0, 10)
    const isSuperAdmin = await this.attendanceLogsService.isUserSuperAdmin(user.id)

    let companyId: number | undefined
    if (isSuperAdmin) {
      companyId = companyIdParameter ? parseInt(companyIdParameter, 10) : undefined
    } else {
      companyId = (await this.attendanceLogsService.getUserCompanyId(user.id)) ?? undefined
    }

    return this.attendanceLogsService.findAll(from ?? today, to ?? today, companyId)
  }

  /**
   * Returns the current user's today attendance status and WFH flag.
   */
  @Get('today-status')
  getTodayStatus(@User() user: UserEntity) {
    return this.attendanceLogsService.getTodayStatus(user.id)
  }

  /**
   * Returns today's QR token for the admin's company (management screen only).
   */
  @Get('today-qr')
  @Permissions('read')
  getTodayQr(@User() user: UserEntity) {
    return this.attendanceLogsService.getTodayQr(user.id)
  }

  /**
   * WFH manual clock-in: records the current time as clock_in.
   * Only succeeds if the user has an approved WFH request for today.
   */
  @Post('clock-in')
  clockIn(@User() user: UserEntity) {
    return this.attendanceLogsService.clockIn(user.id)
  }

  /**
   * WFH manual clock-out: records the current time as clock_out.
   */
  @Post('clock-out')
  clockOut(@User() user: UserEntity) {
    return this.attendanceLogsService.clockOut(user.id)
  }

  /**
   * Exports attendance logs for a given month to Google Sheets.
   * Query params: month (YYYY-MM), company_id (number)
   */
  @Post('export-sheet')
  @Permissions('read')
  exportToSheet(
    @Query('month') month: string,
    @Query('company_id', ParseIntPipe) companyId: number,
  ) {
    const target = month ?? new Date().toISOString().substring(0, 7)
    return this.attendanceLogsService.exportToSheet(companyId, target)
  }

  /**
   * Admin-only: manually adjust clock_in and/or clock_out for an attendance log entry.
   * Records the change in audit history with a mandatory reason.
   */
  @Put(':id')
  @Permissions('update')
  adminEdit(
    @Param('id', ParseIntPipe) id: number,
    @Body(ValidationPipe) dto: AdminEditAttendanceLogDto,
    @User() user: UserEntity,
  ) {
    return this.attendanceLogsService.adminEdit(id, dto, user.id)
  }

  /**
   * Returns the edit history for an attendance log, newest first.
   */
  @Get(':id/history')
  @Permissions('read')
  getEditHistory(@Param('id', ParseIntPipe) id: number) {
    return this.attendanceLogsService.getEditHistory(id)
  }

  /**
   * Face-based check-in/out: matches the submitted descriptor against registered employees,
   * uploads the captured photo, and records the attendance event.
   */
  @Post('face/checkin')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_request, file, callback) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp']

        if (!allowed.includes(file.mimetype)) {
          return callback(
            new BadRequestException('Only JPEG, PNG, or WEBP images are allowed'),
            false,
          )
        }

        callback(null, true)
      },
    }),
  )
  async faceCheckin(
    @UploadedFile() imageFile: Express.Multer.File,
    @Body('descriptor') descriptorJson: string,
    @Body('location') location: string | undefined,
    @Req() request: Request,
  ) {
    if (!imageFile) throw new BadRequestException('Image file is required')

    let descriptor: number[]

    try {
      descriptor = JSON.parse(descriptorJson)
    } catch {
      throw new BadRequestException('descriptor must be a valid JSON array')
    }

    const xRealIp = request.headers['x-real-ip'] as string | undefined
    const xForwarded = request.headers['x-forwarded-for'] as string | undefined
    const clientIp =
      xRealIp?.trim() ||
      (xForwarded ? xForwarded.split(',').slice(-1)[0].trim() : '') ||
      (request.ip ?? '')

    const deviceInfo = (request.headers['user-agent'] as string | undefined) ?? ''

    return this.attendanceLogsService.faceCheckin(
      descriptor,
      imageFile,
      clientIp,
      deviceInfo,
      location,
    )
  }

  /**
   * Returns attendance logs for a given date (defaults to today).
   */
  @Get('history')
  @Permissions('read')
  getHistory(@Query('date') date?: string) {
    const target = date ?? new Date().toISOString().substring(0, 10)

    return this.attendanceLogsService.getByDate(target)
  }

  /**
   * Returns today's attendance summary counts.
   */
  @Get('stats/today')
  @Permissions('read')
  getTodayStats() {
    return this.attendanceLogsService.getTodayStats()
  }

  /**
   * QR-based clock-in/out: validates the QR token and the client IP against the company whitelist.
   */
  @Post('clock-qr')
  clockQr(
    @Body(ValidationPipe) dto: ClockQrDto,
    @User() user: UserEntity,
    @Req() request: Request,
  ) {
    // Prefer X-Real-IP (set by Nginx to $remote_addr, cannot be spoofed).
    // Fall back to the rightmost X-Forwarded-For entry (closest to real client),
    // then request.ip for direct connections (local dev without proxy).
    const xRealIp = request.headers['x-real-ip'] as string | undefined
    const xForwarded = request.headers['x-forwarded-for'] as string | undefined
    const clientIp =
      xRealIp?.trim() ||
      (xForwarded ? xForwarded.split(',').slice(-1)[0].trim() : '') ||
      (request.ip ?? '')
    return this.attendanceLogsService.clockByQr(
      dto.token,
      dto.date,
      dto.companyId,
      user.id,
      clientIp,
    )
  }
}
