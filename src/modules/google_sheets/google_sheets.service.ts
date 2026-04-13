import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { google } from 'googleapis'
import type { EmployeeRequest } from '@/modules/employee_requests/entities/employee_request.entity'
import {
  CompanyGoogleSheet,
  ColumnConfigItem,
  REQUEST_TYPE_ALL,
} from './entities/company_google_sheet.entity'
import { SlackChannelsService } from '@/modules/slack_channels/slack_channels.service'
import { ErrorLogsService } from '@/modules/error_logs/error_logs.service'

/** Default column layout — mirrors the original hardcoded A–N mapping */
export const DEFAULT_COLUMN_CONFIG: ColumnConfigItem[] = [
  { column: 'A', field: 'id', header: 'ID' },
  { column: 'B', field: 'created_at', header: 'Submit Time' },
  { column: 'C', field: 'user.email', header: 'Email' },
  { column: 'D', field: 'user.position', header: 'Position' },
  { column: 'E', field: 'user.full_name', header: 'Full Name' },
  { column: 'F', field: 'leave_type', header: 'Leave Type' },
  { column: 'G', field: 'from_datetime', header: 'From' },
  { column: 'H', field: 'to_datetime', header: 'To' },
  { column: 'I', field: 'unit_hours', header: 'Hours' },
  { column: 'J', field: 'reason', header: 'Reason' },
  { column: 'K', field: 'note', header: 'Note' },
  { column: 'L', field: 'status', header: 'Status' },
  { column: 'M', field: 'approver.full_name', header: 'Approver Name' },
  { column: 'N', field: 'approver_note', header: 'Approver Note' },
]

/** Fields that are written only during approval (not on create/update) */
const APPROVAL_FIELDS = new Set(['status', 'approver.full_name', 'approver_note'])

interface SheetConfig {
  spreadsheetId: string
  sheetName: string
  columnConfig: ColumnConfigItem[]
}

@Injectable()
export class GoogleSheetsService {
  private readonly logger = new Logger(GoogleSheetsService.name)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private sheets: any | null = null
  // Cache: key = `${spreadsheetId}:${sheetName}` → numeric sheetId
  private readonly sheetIdCache = new Map<string, number>()

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(CompanyGoogleSheet)
    private readonly companyGoogleSheetRepository: Repository<CompanyGoogleSheet>,
    private readonly slackChannelsService: SlackChannelsService,
    private readonly errorLogsService: ErrorLogsService,
  ) {
    this.initialize()
  }

  private initialize(): void {
    const keyFile = this.configService.get<string>('GOOGLE_SHEETS_KEY_FILE')
    const credentialsJson = this.configService.get<string>('GOOGLE_SHEETS_CREDENTIALS')

    if (!keyFile && !credentialsJson) {
      this.logger.warn(
        'Google Sheets integration disabled: set GOOGLE_SHEETS_KEY_FILE or GOOGLE_SHEETS_CREDENTIALS',
      )
      return
    }

    try {
      const authOptions = keyFile
        ? { keyFile, scopes: ['https://www.googleapis.com/auth/spreadsheets'] }
        : {
            credentials: JSON.parse(credentialsJson!) as object,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
          }

      const auth = new google.auth.GoogleAuth(authOptions)
      this.sheets = google.sheets({ version: 'v4', auth })
    } catch (error) {
      this.logger.error('Failed to initialize Google Sheets client', error)
      this.errorLogsService.logError({
        message: 'Failed to initialize Google Sheets client',
        stackTrace: (error as Error).stack ?? null,
        path: 'google_sheets',
      })
    }
  }

  /**
   * Resolves the sheet configuration for a given company and request type.
   * Lookup order: type-specific config → 'all' fallback → env var fallback.
   * @param defaultColumnConfig - column config to use when DB record has no explicit column_config,
   *   or when falling back to env var. Defaults to DEFAULT_COLUMN_CONFIG (EmployeeRequest columns).
   */
  async getSheetConfig(
    companyId: number,
    requestType: string,
    defaultColumnConfig: ColumnConfigItem[] = DEFAULT_COLUMN_CONFIG,
  ): Promise<SheetConfig | null> {
    // 1. Try exact type match
    let config = await this.companyGoogleSheetRepository.findOne({
      where: { company_id: companyId, request_type: requestType, is_active: true },
    })

    // 2. Fall back to 'all' config for this company
    if (!config) {
      config = await this.companyGoogleSheetRepository.findOne({
        where: { company_id: companyId, request_type: REQUEST_TYPE_ALL, is_active: true },
      })
    }

    if (config) {
      return {
        spreadsheetId: config.spreadsheet_id,
        sheetName: config.sheet_name,
        columnConfig: config.column_config ?? defaultColumnConfig,
      }
    }

    // 3. Global env var fallback
    const fallbackSpreadsheetId = this.configService.get<string>('GOOGLE_SHEETS_SPREADSHEET_ID')
    if (fallbackSpreadsheetId) {
      return {
        spreadsheetId: fallbackSpreadsheetId,
        sheetName: this.configService.get<string>('GOOGLE_SHEETS_SHEET_NAME') ?? 'Leave Requests',
        columnConfig: defaultColumnConfig,
      }
    }

    return null
  }

  /**
   * Converts a column letter (A, B, ... Z, AA, ...) to a 0-based index.
   */
  private columnToIndex(col: string): number {
    let index = 0
    for (let position = 0; position < col.length; position++) {
      index = index * 26 + (col.toUpperCase().charCodeAt(position) - 64)
    }
    return index - 1
  }

  /**
   * Resolves a dot-notation field path against an EmployeeRequest.
   */
  private getFieldValue(request: EmployeeRequest, field: string): string | number {
    switch (field) {
      case 'id':
        return request.id
      case 'created_at':
        return this.formatDatetime(request.created_at)
      case 'user.email':
        return request.user?.email ?? ''
      case 'user.full_name':
        return request.user?.full_name ?? ''
      case 'user.position':
        return request.user?.position ?? ''
      case 'type':
        return request.type ?? ''
      case 'leave_type':
        return request.leave_type ?? ''
      case 'from_datetime':
        return this.formatDatetime(request.from_datetime)
      case 'to_datetime':
        return this.formatDatetime(request.to_datetime)
      case 'unit_hours':
        return request.unit_hours != null ? Number(request.unit_hours) : ''
      case 'reason':
        return request.reason ?? ''
      case 'note':
        return request.note ?? ''
      case 'status':
        return request.status ?? ''
      case 'approver.full_name':
        return request.approver?.full_name ?? ''
      case 'approver_note':
        return request.approver_note ?? ''
      case 'equipment_name':
        return request.equipment_name ?? ''
      case 'location':
        return request.location ?? ''
      case 'quantity':
        return request.quantity != null ? Number(request.quantity) : ''
      case 'clock_type':
        return request.clock_type ?? ''
      case 'forget_date':
        return request.forget_date ? String(request.forget_date) : ''
      case 'overtime_type':
        return request.overtime_type ?? ''
      default:
        return ''
    }
  }

  /**
   * Builds a sparse row array from the column config.
   * Gaps between configured columns are filled with empty strings.
   */
  private buildRow(
    request: EmployeeRequest,
    columnConfig: ColumnConfigItem[],
    fieldsFilter?: (field: string) => boolean,
  ): (string | number)[] {
    const filtered = fieldsFilter
      ? columnConfig.filter((item) => fieldsFilter(item.field))
      : columnConfig

    if (filtered.length === 0) return []

    const maxIndex = Math.max(...filtered.map((item) => this.columnToIndex(item.column)))
    const row = new Array<string | number>(maxIndex + 1).fill('')

    for (const item of filtered) {
      row[this.columnToIndex(item.column)] = this.getFieldValue(request, item.field)
    }
    return row
  }

  /**
   * Returns the leftmost column letter from a set of config items.
   */
  private leftmostColumn(items: ColumnConfigItem[]): string {
    return items.reduce((previous, current) =>
      this.columnToIndex(previous.column) <= this.columnToIndex(current.column)
        ? previous
        : current,
    ).column
  }

  /**
   * Returns the rightmost column letter from a set of config items.
   */
  private rightmostColumn(items: ColumnConfigItem[]): string {
    return items.reduce((previous, current) =>
      this.columnToIndex(previous.column) >= this.columnToIndex(current.column)
        ? previous
        : current,
    ).column
  }

  /**
   * Fetches and caches the numeric sheetId for a given spreadsheet + sheet name.
   * Required for batchUpdate calls (which need sheetId, not sheet name).
   */
  private async getSheetId(spreadsheetId: string, sheetName: string): Promise<number | null> {
    const cacheKey = `${spreadsheetId}:${sheetName}`
    if (this.sheetIdCache.has(cacheKey)) return this.sheetIdCache.get(cacheKey)!

    try {
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId,
        fields: 'sheets.properties',
      })

      const sheetItem = response.data.sheets?.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (sheet: any) => sheet.properties?.title === sheetName,
      )
      const numericSheetId: number | null = sheetItem?.properties?.sheetId ?? null
      if (numericSheetId !== null) this.sheetIdCache.set(cacheKey, numericSheetId)
      return numericSheetId
    } catch (error) {
      this.logger.error('Failed to fetch sheetId', error)
      this.errorLogsService.logError({
        message: 'Failed to fetch sheetId',
        stackTrace: (error as Error).stack ?? null,
        path: 'google_sheets',
      })
      return null
    }
  }

  /**
   * Clears the background color of a row so it does not inherit header formatting.
   */
  private async clearRowBackground(
    spreadsheetId: string,
    sheetName: string,
    rowIndex: number,
  ): Promise<void> {
    const sheetId = await this.getSheetId(spreadsheetId, sheetName)
    if (sheetId === null) return
    try {
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              repeatCell: {
                range: {
                  sheetId,
                  startRowIndex: rowIndex - 1,
                  endRowIndex: rowIndex,
                },
                cell: { userEnteredFormat: { backgroundColor: { red: 1, green: 1, blue: 1 } } },
                fields: 'userEnteredFormat.backgroundColor',
              },
            },
          ],
        },
      })
    } catch (error) {
      this.logger.error(`Failed to clear row background for row ${rowIndex}`, error)
      this.errorLogsService.logError({
        message: `Failed to clear row background for row ${rowIndex}`,
        stackTrace: (error as Error).stack ?? null,
        path: 'google_sheets',
      })
    }
  }

  private formatDatetime(value: Date | string | undefined | null): string {
    if (!value) return ''
    return new Date(value).toLocaleString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  /**
   * Returns true if the Google Sheets client is initialized and ready to use.
   */
  isReady(): boolean {
    return this.sheets !== null
  }

  /**
   * Clears a sheet range and writes bulk data (header + rows).
   * Used for full exports like attendance logs.
   */
  async writeBulkData(
    spreadsheetId: string,
    sheetName: string,
    values: (string | number)[][],
  ): Promise<void> {
    await this.sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `${sheetName}!A:Z`,
    })
    await this.sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values },
    })
  }

  /**
   * Appends a new row for a submitted employee request.
   * Returns the 1-based row index of the inserted row, or null on failure.
   */
  async appendRequestRow(
    request: EmployeeRequest,
    companyId: number,
    requestType: string,
  ): Promise<number | null> {
    if (!this.sheets) return null

    const config = await this.getSheetConfig(companyId, requestType)
    if (!config) {
      this.logger.warn(`No Google Sheet configured for company ${companyId} / type ${requestType}`)
      return null
    }

    const row = this.buildRow(request, config.columnConfig)

    try {
      const response = await this.sheets.spreadsheets.values.append({
        spreadsheetId: config.spreadsheetId,
        range: `${config.sheetName}!A:A`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [row] },
      })

      const updatedRange: string = response.data?.updates?.updatedRange ?? ''
      const match = updatedRange.match(/:?[A-Z]+(\d+)$/)

      if (match) {
        const rowIndex = parseInt(match[1], 10)
        await this.clearRowBackground(config.spreadsheetId, config.sheetName, rowIndex)
        return rowIndex
      }

      return null
    } catch (error) {
      this.logger.error('Failed to append request row to Google Sheets', error)
      this.errorLogsService.logError({
        message: 'Failed to append request row to Google Sheets',
        stackTrace: (error as Error).stack ?? null,
        path: 'google_sheets',
      })
      this.slackChannelsService.sendSystemError(
        `[GoogleSheets] Failed to append request row for requestId=${request.id} companyId=${companyId}: ${(error as Error).message}`,
      )
      return null
    }
  }

  /**
   * Updates the data columns (non-approval fields) of an existing row when a request is edited.
   * Approval columns (status, approver name, note) are preserved.
   */
  async updateRequestDataRow(
    rowIndex: number,
    request: EmployeeRequest,
    companyId: number,
    requestType: string,
  ): Promise<void> {
    if (!this.sheets) return

    const config = await this.getSheetConfig(companyId, requestType)
    if (!config) return

    const dataItems = config.columnConfig.filter((item) => !APPROVAL_FIELDS.has(item.field))
    if (dataItems.length === 0) return

    // Build the full-width row and update each data column individually to avoid overwriting approval columns
    for (const item of dataItems) {
      try {
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: config.spreadsheetId,
          range: `${config.sheetName}!${item.column}${rowIndex}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [[this.getFieldValue(request, item.field)]] },
        })
      } catch (error) {
        this.logger.error(
          `Failed to update column ${item.column} row ${rowIndex} in Google Sheets`,
          error,
        )
        this.errorLogsService.logError({
          message: `Failed to update column ${item.column} row ${rowIndex} in Google Sheets`,
          stackTrace: (error as Error).stack ?? null,
          path: 'google_sheets',
        })
      }
    }
  }

  /**
   * Updates the approval columns (status, approver name, approver note) for an existing row.
   */
  async updateApprovalRow(
    rowIndex: number,
    status: string,
    approverName: string,
    approverNote: string,
    companyId: number,
    requestType: string,
  ): Promise<void> {
    if (!this.sheets) return

    const config = await this.getSheetConfig(companyId, requestType)
    if (!config) return

    const approvalValues: Record<string, string> = {
      status,
      'approver.full_name': approverName,
      approver_note: approverNote,
    }

    for (const item of config.columnConfig) {
      if (!APPROVAL_FIELDS.has(item.field)) continue
      try {
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: config.spreadsheetId,
          range: `${config.sheetName}!${item.column}${rowIndex}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [[approvalValues[item.field] ?? '']] },
        })
      } catch (error) {
        this.logger.error(`Failed to update approval column ${item.column} row ${rowIndex}`, error)
        this.errorLogsService.logError({
          message: `Failed to update approval column ${item.column} row ${rowIndex}`,
          stackTrace: (error as Error).stack ?? null,
          path: 'google_sheets',
        })
      }
    }
  }
}
