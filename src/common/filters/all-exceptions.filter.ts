import { ExceptionFilter, Catch, ArgumentsHost, HttpException, Logger } from '@nestjs/common'
import { Request, Response } from 'express'
import { DataSource, Repository } from 'typeorm'
import { ErrorLog } from '@/modules/error_logs/entities/error_log.entity'
import type { ErrorLogLevel } from '@/modules/error_logs/entities/error_log.entity'

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
          : ((exceptionResponse as Record<string, unknown>).message ?? exception.message)
      if (Array.isArray(message)) {
        message = message.join('; ')
      }
    } else if (exception instanceof Error) {
      message = exception.message
    } else {
      message = String(exception)
    }

    // Determine log level based on status code
    let level: ErrorLogLevel = 'error'

    if (statusCode >= 500) {
      level = 'error'
    } else if (statusCode >= 400) {
      level = 'warn'
    } else {
      level = 'fatal'
    }

    // Truncate message
    const truncatedMessage =
      typeof message === 'string' && message.length > MAX_MESSAGE_LENGTH
        ? message.substring(0, MAX_MESSAGE_LENGTH)
        : String(message)

    // Extract stack trace
    const stackTrace = exception instanceof Error ? (exception.stack ?? null) : null

    // Extract user context
    const user = (request as Record<string, unknown>).user as Record<string, unknown> | null

    // Sanitize request data
    const sanitizedBody = this.sanitize(request.body)
    const sanitizedHeaders = this.sanitize(request.headers)

    // Build error log entry
    const errorLogEntry = {
      level,
      message: truncatedMessage,
      stack_trace: stackTrace,
      status_code: statusCode,
      path: request.url?.substring(0, 500),
      method: request.method,
      request_body: sanitizedBody ? JSON.stringify(sanitizedBody).substring(0, 65535) : null,
      request_query: request.query ? JSON.stringify(request.query).substring(0, 1000) : null,
      request_headers: JSON.stringify(sanitizedHeaders).substring(0, 65535),
      user_id: user?.id ? Number(user.id) : null,
      user_email: user?.email ? String(user.email).substring(0, 255) : null,
      user_name: user?.full_name ? String(user.full_name).substring(0, 255) : null,
      ip_address: (request.headers['x-forwarded-for'] as string | undefined) ?? request.ip ?? null,
      user_agent: request.headers['user-agent']
        ? String(request.headers['user-agent']).substring(0, 500)
        : null,
      is_resolved: false,
    }

    // Fire-and-forget async insert
    this.errorLogRepository.insert(errorLogEntry).catch((databaseError) => {
      this.logger.error(
        'Failed to save error log to database',
        databaseError instanceof Error ? databaseError.message : String(databaseError),
      )
    })

    // Also log to console for Docker visibility
    this.logger.error(
      `[${level}] ${statusCode} ${request.method} ${request.url} - ${truncatedMessage}`,
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
