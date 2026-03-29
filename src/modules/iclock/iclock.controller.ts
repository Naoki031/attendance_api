import { Controller, Get, Post, Query, Req, Res, Logger } from '@nestjs/common'
import { Request, Response } from 'express'
import { ConfigService } from '@nestjs/config'
import { Public } from '@/modules/auth/decorators/public.decorator'
import { IclockService } from './iclock.service'

@Controller('iclock')
export class IclockController {
  private readonly logger = new Logger(IclockController.name)

  constructor(
    private readonly iclockService: IclockService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Validates the device serial number against the ZK_ALLOWED_SNS whitelist.
   * Returns true if allowed (or if whitelist is not configured).
   */
  private isAllowedSn(serialNumber: string): boolean {
    const allowedRaw = this.configService.get<string>('ZK_ALLOWED_SNS') ?? ''
    if (!allowedRaw.trim()) return true // No whitelist configured → allow all

    const allowed = allowedRaw
      .split(',')
      .map((sn) => sn.trim())
      .filter(Boolean)

    return allowed.includes(serialNumber)
  }

  /**
   * Heartbeat endpoint — device calls this every ~30 seconds to check in and get server time.
   * Also handles OPERLOG and other non-ATTLOG table pushes.
   * Response format expected by ZKTeco: "GET STAMPTIME\nDate:YYYY-MM-DD HH:MM:SS\n"
   */
  @Get('cdata')
  @Public()
  heartbeat(@Query('SN') serialNumber: string, @Res() response: Response): void {
    if (!this.isAllowedSn(serialNumber)) {
      this.logger.warn(`[ICLOCK] Rejected unknown device SN=${serialNumber}`)
      response.status(403).send('Forbidden')
      return
    }

    const dateTime = this.iclockService.getCurrentVnDatetime()
    const syncFromDate = this.configService.get<string>('ZK_SYNC_FROM_DATE') ?? '2025-01-01'
    this.logger.log(`[ICLOCK] Heartbeat from SN=${serialNumber} — responding with Date:${dateTime}`)

    // Include GET ATTLOG to instruct device to push pending attendance records immediately
    response
      .set('Content-Type', 'text/plain')
      .send(`GET STAMPTIME\nDate:${dateTime}\nGET ATTLOG SDate=${syncFromDate}\n`)
  }

  /**
   * Attendance data push endpoint — device POSTs ATTLOG records after clocking events.
   * Body is plain text with tab-separated fields, one record per line.
   */
  @Post('cdata')
  @Public()
  async pushData(
    @Query('SN') serialNumber: string,
    @Query('table') table: string,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    if (!this.isAllowedSn(serialNumber)) {
      this.logger.warn(`[ICLOCK] Rejected push from unknown device SN=${serialNumber}`)
      response.status(403).send('Forbidden')
      return
    }

    this.logger.log(`[ICLOCK] POST cdata from SN=${serialNumber} table=${table}`)

    // Only process ATTLOG — ignore OPERLOG, BIODATA, etc.
    if (table !== 'ATTLOG') {
      this.logger.log(`[ICLOCK] Ignoring table=${table} from SN=${serialNumber}`)
      response.set('Content-Type', 'text/plain').send('OK: 0')
      return
    }

    const body = typeof request.body === 'string' ? request.body : ''
    this.logger.log(`[ICLOCK] ATTLOG push from SN=${serialNumber} — body length: ${body.length}`)

    const records = this.iclockService.parseAttlog(body)
    const result = await this.iclockService.processAttlog(records)

    this.logger.log(
      `[ICLOCK] Processed ${result.total} records — saved: ${result.saved}, skipped: ${result.skipped}`,
    )

    response.set('Content-Type', 'text/plain').send(`OK: ${result.saved}`)
  }

  /**
   * Command poll endpoint — device asks whether the server has any pending commands.
   * Responding with "OK" means no commands queued.
   */
  @Post('getrequest')
  @Public()
  getRequest(@Query('SN') serialNumber: string, @Res() response: Response): void {
    this.logger.debug(`[ICLOCK] getrequest from SN=${serialNumber}`)
    response.set('Content-Type', 'text/plain').send('OK')
  }

  /**
   * Command result endpoint — device reports the result of an executed command.
   */
  @Post('devicecmd')
  @Public()
  deviceCmd(
    @Query('SN') serialNumber: string,
    @Query('ID') commandId: string,
    @Query('Return') returnCode: string,
    @Res() response: Response,
  ): void {
    this.logger.debug(
      `[ICLOCK] devicecmd from SN=${serialNumber} — ID=${commandId} Return=${returnCode}`,
    )
    response.set('Content-Type', 'text/plain').send('OK')
  }
}
