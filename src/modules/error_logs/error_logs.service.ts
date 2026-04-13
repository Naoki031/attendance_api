import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, LessThan, In } from 'typeorm'
import { ErrorLog } from './entities/error_log.entity'
import { QueryErrorLogDto } from './dto/query-error_log.dto'
import moment from 'moment'

export interface ErrorLogStats {
  total: number
  unresolved: number
  resolved: number
  errorCount: number
  warnCount: number
  fatalCount: number
}

@Injectable()
export class ErrorLogsService {
  private readonly logger = new Logger(ErrorLogsService.name)

  constructor(
    @InjectRepository(ErrorLog)
    private readonly errorLogRepository: Repository<ErrorLog>,
  ) {}

  /**
   * Retrieves paginated error logs with optional filters.
   */
  async findAll(query: QueryErrorLogDto): Promise<{
    data: ErrorLog[]
    total: number
    page: number
    limit: number
  }> {
    const page = query.page ?? 1
    const limit = query.limit ?? 50
    const queryBuilder = this.errorLogRepository
      .createQueryBuilder('log')
      .orderBy('log.created_at', 'DESC')

    if (query.level) {
      queryBuilder.andWhere('log.level = :level', { level: query.level })
    }

    if (query.is_resolved !== undefined) {
      queryBuilder.andWhere('log.is_resolved = :isResolved', {
        isResolved: query.is_resolved,
      })
    }

    if (query.search) {
      queryBuilder.andWhere('(log.message LIKE :search OR log.path LIKE :search)', {
        search: `%${query.search}%`,
      })
    }

    if (query.date_from) {
      queryBuilder.andWhere('log.created_at >= :dateFrom', {
        dateFrom: moment.utc(query.date_from).startOf('day').toDate(),
      })
    }

    if (query.date_to) {
      queryBuilder.andWhere('log.created_at <= :dateTo', {
        dateTo: moment.utc(query.date_to).endOf('day').toDate(),
      })
    }

    if (query.status_code) {
      queryBuilder.andWhere('log.status_code = :statusCode', {
        statusCode: query.status_code,
      })
    }

    const [data, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount()

    return { data, total, page, limit }
  }

  /**
   * Retrieves a single error log by ID.
   */
  async findOne(id: number): Promise<ErrorLog> {
    const log = await this.errorLogRepository.findOne({ where: { id } })

    if (!log) {
      throw new NotFoundException(`ErrorLog not found with id: ${id}`)
    }

    return log
  }

  /**
   * Returns aggregate statistics for error logs.
   */
  async getStats(): Promise<ErrorLogStats> {
    const result = await this.errorLogRepository
      .createQueryBuilder('log')
      .select([
        'COUNT(*) AS total',
        'SUM(CASE WHEN log.is_resolved = false THEN 1 ELSE 0 END) AS unresolved',
        'SUM(CASE WHEN log.is_resolved = true THEN 1 ELSE 0 END) AS resolved',
        "SUM(CASE WHEN log.level = 'error' THEN 1 ELSE 0 END) AS errorCount",
        "SUM(CASE WHEN log.level = 'warn' THEN 1 ELSE 0 END) AS warnCount",
        "SUM(CASE WHEN log.level = 'fatal' THEN 1 ELSE 0 END) AS fatalCount",
      ])
      .getRawOne()

    return {
      total: Number(result?.total ?? 0),
      unresolved: Number(result?.unresolved ?? 0),
      resolved: Number(result?.resolved ?? 0),
      errorCount: Number(result?.errorCount ?? 0),
      warnCount: Number(result?.warnCount ?? 0),
      fatalCount: Number(result?.fatalCount ?? 0),
    }
  }

  /**
   * Marks a single error log as resolved.
   */
  async resolve(id: number, resolvedBy: number): Promise<ErrorLog> {
    await this.errorLogRepository.update(
      { id },
      { is_resolved: true, resolved_by: resolvedBy, resolved_at: moment.utc().toDate() },
    )

    return this.findOne(id)
  }

  /**
   * Marks multiple error logs as resolved in batch.
   */
  async resolveMany(ids: number[], resolvedBy: number): Promise<number> {
    const result = await this.errorLogRepository.update(
      { id: In(ids), is_resolved: false },
      { is_resolved: true, resolved_by: resolvedBy, resolved_at: moment.utc().toDate() },
    )

    return result.affected ?? 0
  }

  /**
   * Deletes error logs older than the specified number of days.
   */
  async purge(olderThanDays: number): Promise<number> {
    const cutoff = moment.utc().subtract(olderThanDays, 'days').toDate()
    const result = await this.errorLogRepository.delete({
      created_at: LessThan(cutoff),
    })

    return result.affected ?? 0
  }
}
