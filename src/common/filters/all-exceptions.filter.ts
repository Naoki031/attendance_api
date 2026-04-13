import { ExceptionFilter, Catch, ArgumentsHost, HttpException, Logger } from '@nestjs/common'
import { Request, Response } from 'express'
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
   * Persists an error log entry to the database (fire-and-forget).
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

    const entry = {
      level: data.level,
      message: truncatedMessage,
      stack_trace: data.stackTrace,
      status_code: data.statusCode,
      path: data.request.url?.substring(0, 500),
      method: data.request.method,
      request_body: sanitizedBody ? JSON.stringify(sanitizedBody).substring(0, 65535) : null,
      request_query: data.request.query
        ? JSON.stringify(data.request.query).substring(0, 1000)
        : null,
      request_headers: JSON.stringify(sanitizedHeaders).substring(0, 65535),
      user_id: data.user?.id ? Number(data.user.id) : null,
      user_email: data.user?.email ? String(data.user.email).substring(0, 255) : null,
      user_name: data.user?.full_name ? String(data.user.full_name).substring(0, 255) : null,
      ip_address:
        (data.request.headers['x-forwarded-for'] as string | undefined) ?? data.request.ip ?? null,
      user_agent: data.request.headers['user-agent']
        ? String(data.request.headers['user-agent']).substring(0, 500)
        : null,
      is_resolved: false,
    }

    this.errorLogRepository.insert(entry).catch((databaseError) => {
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
