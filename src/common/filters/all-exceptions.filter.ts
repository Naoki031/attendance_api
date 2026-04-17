import { ExceptionFilter, Catch, ArgumentsHost, HttpException, Logger } from '@nestjs/common'
import { Request, Response } from 'express'
import { createHash } from 'crypto'
import { DataSource, Repository } from 'typeorm'
import { ErrorLog } from '@/modules/error_logs/entities/error_log.entity'

const SENSITIVE_KEYS = [
  'password',
  'confirmpassword',
  'currentpassword',
  'newpassword',
  'token',
  'accesstoken',
  'refreshtoken',
  'access_token',
  'refresh_token',
  'authorization',
  'cookie',
  'secret',
  'apikey',
  'api_key',
  'creditcard',
  'cardnumber',
  'cvv',
  'ssn',
]

const MAX_MESSAGE_LENGTH = 500

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name)
  private readonly errorLogRepository: Repository<ErrorLog>

  constructor(private readonly dataSource: DataSource) {
    this.errorLogRepository = dataSource.getRepository(ErrorLog)
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp()
    const response = context.getResponse<Response>()
    const request = context.getRequest<Request>()

    let statusCode = 500
    let message = 'Internal server error'

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus()
      const exceptionResponse = exception.getResponse()
      message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : String((exceptionResponse as Record<string, unknown>).message ?? exception.message)
      if (Array.isArray(message)) {
        message = message.join('; ')
      }
    } else if (exception instanceof Error) {
      message = exception.message
    } else {
      message = String(exception)
    }

    // Persist all errors to DB: 4xx (client errors) as 'warn', 5xx (server errors) as 'error'.
    const level = statusCode >= 500 ? 'error' : 'warn'
    this.persistErrorLog({
      level,
      message,
      statusCode,
      stackTrace: exception instanceof Error ? (exception.stack ?? null) : null,
      request,
      user: (request as unknown as Record<string, unknown>).user as Record<string, unknown> | null,
    })

    // Log to console for Docker visibility (all status codes)
    const truncatedMessage =
      typeof message === 'string' && message.length > MAX_MESSAGE_LENGTH
        ? message.substring(0, MAX_MESSAGE_LENGTH)
        : String(message)
    this.logger.warn(
      `[${statusCode >= 500 ? 'error' : 'warn'}] ${statusCode} ${request.method} ${request.url} - ${truncatedMessage}`,
    )

    // Send response to client
    if (!response.headersSent) {
      response.status(statusCode).json({
        statusCode,
        message: typeof message === 'string' ? message : 'Internal server error',
        error: exception instanceof HttpException ? exception.name : 'Error',
      })
    }
  }

  /**
   * Computes a SHA-256 fingerprint for deduplication.
   * Uses path without query string so ?page=1 and ?page=2 map to the same error.
   */
  private computeFingerprint(
    message: string,
    method: string,
    url: string,
    statusCode: number,
  ): string {
    const pathBase = url.split('?')[0] ?? url
    const raw = `${message}|${method}|${pathBase}|${statusCode}`
    return createHash('sha256').update(raw).digest('hex')
  }

  /**
   * Persists an error log entry to the database (fire-and-forget).
   * Uses INSERT ... ON DUPLICATE KEY UPDATE to deduplicate identical errors:
   * - First occurrence: insert full record including request body/query
   * - Subsequent occurrences: increment occurrence_count, re-open if resolved, skip request data
   */
  private persistErrorLog(data: {
    level: 'error' | 'warn' | 'fatal'
    message: string
    statusCode: number
    stackTrace: string | null
    request: Request
    user: Record<string, unknown> | null
  }): void {
    const truncatedMessage =
      data.message.length > MAX_MESSAGE_LENGTH
        ? data.message.substring(0, MAX_MESSAGE_LENGTH)
        : data.message

    const sanitizedBody = this.sanitize(data.request.body)
    const sanitizedHeaders = this.sanitize(data.request.headers)
    const fingerprint = this.computeFingerprint(
      truncatedMessage,
      data.request.method,
      data.request.url ?? '',
      data.statusCode,
    )

    const sql = `
      INSERT INTO error_logs
        (fingerprint, level, message, stack_trace, status_code, path, method,
         request_body, request_query, request_headers,
         user_id, user_email, user_name, ip_address, user_agent,
         is_resolved, occurrence_count, last_occurred_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, NOW())
      ON DUPLICATE KEY UPDATE
        occurrence_count = occurrence_count + 1,
        last_occurred_at = NOW(),
        is_resolved = 0,
        resolved_by = NULL,
        resolved_at = NULL
    `

    const parameters = [
      fingerprint,
      data.level,
      truncatedMessage,
      data.stackTrace,
      data.statusCode,
      data.request.url?.substring(0, 500) ?? null,
      data.request.method,
      sanitizedBody ? JSON.stringify(sanitizedBody).substring(0, 65535) : null,
      data.request.query ? JSON.stringify(data.request.query).substring(0, 1000) : null,
      JSON.stringify(sanitizedHeaders).substring(0, 65535),
      data.user?.id ? Number(data.user.id) : null,
      data.user?.email ? String(data.user.email).substring(0, 255) : null,
      data.user?.full_name ? String(data.user.full_name).substring(0, 255) : null,
      (data.request.headers['x-forwarded-for'] as string | undefined) ?? data.request.ip ?? null,
      data.request.headers['user-agent']
        ? String(data.request.headers['user-agent']).substring(0, 500)
        : null,
    ]

    this.dataSource.query(sql, parameters).catch((databaseError: unknown) => {
      this.logger.error(
        'Failed to save error log to database',
        databaseError instanceof Error ? databaseError.message : String(databaseError),
      )
    })
  }

  /**
   * Recursively sanitizes an object by redacting sensitive keys.
   */
  private sanitize(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object') {
      return null
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.sanitize(item)) as unknown as Record<string, unknown>
    }

    const result: Record<string, unknown> = {}
    const entries = Object.entries(value as Record<string, unknown>)

    for (const [key, value_] of entries) {
      const lowerKey = key.toLowerCase()

      if (SENSITIVE_KEYS.some((sensitive) => lowerKey.includes(sensitive))) {
        result[key] = '***REDACTED***'
      } else if (typeof value_ === 'object' && value_ !== null) {
        result[key] = this.sanitize(value_)
      } else {
        result[key] = value_
      }
    }

    return result
  }
}
