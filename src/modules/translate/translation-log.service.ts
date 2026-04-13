import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, LessThan } from 'typeorm'
import { TranslationLog } from './entities/translation_log.entity'
import { QueryTranslationLogDto } from './dto/query-translation-log.dto'
import moment from 'moment'
import { ErrorLogsService } from '@/modules/error_logs/error_logs.service'

export interface TranslationLogEntry {
  messageId?: number
  sourceLang: string
  targetLangs: string[]
  inputLength: number
  status: 'success' | 'error' | 'partial'
  errorMessage?: string
  inputTokens?: number
  outputTokens?: number
  cacheCreationTokens?: number
  cacheReadTokens?: number
  modelUsed?: string
  durationMs?: number
  mode?: 'sync' | 'stream'
}

export interface TranslationLogStats {
  totalRequests: number
  successCount: number
  errorCount: number
  cacheHitRate: number
  tokensSavedRate: number
  avgDurationMs: number
  totalInputTokens: number
  totalOutputTokens: number
  totalCacheCreationTokens: number
  totalCacheReadTokens: number
}

export interface CacheBreakdownItem {
  sourceLang: string
  targetLang: string
  totalRequests: number
  cacheHits: number
  cacheHitRate: number
  avgDurationMs: number
  totalInputTokens: number
  totalCacheReadTokens: number
}

@Injectable()
export class TranslationLogService {
  private readonly logger = new Logger(TranslationLogService.name)

  constructor(
    @InjectRepository(TranslationLog)
    private readonly logRepository: Repository<TranslationLog>,
    private readonly errorLogsService: ErrorLogsService,
  ) {}

  /**
   * Logs a translation API call. Designed to be fire-and-forget —
   * errors are caught and logged, never thrown.
   */
  async logTranslation(entry: TranslationLogEntry): Promise<void> {
    try {
      await this.logRepository.save({
        messageId: entry.messageId,
        sourceLang: entry.sourceLang,
        targetLangs: entry.targetLangs,
        inputLength: entry.inputLength,
        status: entry.status,
        errorMessage: entry.errorMessage,
        inputTokens: entry.inputTokens,
        outputTokens: entry.outputTokens,
        cacheCreationTokens: entry.cacheCreationTokens,
        cacheReadTokens: entry.cacheReadTokens,
        modelUsed: entry.modelUsed,
        durationMs: entry.durationMs,
        mode: entry.mode,
      })
    } catch (error) {
      this.logger.error('Failed to save translation log', error)
      this.errorLogsService.logError({
        message: 'Failed to save translation log',
        stackTrace: (error as Error).stack ?? null,
        path: 'translation_log',
      })
    }
  }

  /**
   * Retrieves paginated translation logs with optional filters.
   */
  async findAll(query: QueryTranslationLogDto): Promise<{
    data: TranslationLog[]
    total: number
    page: number
    limit: number
  }> {
    try {
      const page = query.page ?? 1
      const limit = query.limit ?? 50
      const qb = this.logRepository.createQueryBuilder('log').orderBy('log.created_at', 'DESC')

      if (query.status) {
        qb.andWhere('log.status = :status', { status: query.status })
      }

      if (query.dateFrom) {
        qb.andWhere('log.created_at >= :dateFrom', {
          dateFrom: moment.utc(query.dateFrom).startOf('day').toDate(),
        })
      }

      if (query.dateTo) {
        qb.andWhere('log.created_at <= :dateTo', {
          dateTo: moment.utc(query.dateTo).endOf('day').toDate(),
        })
      }

      const [data, total] = await qb
        .skip((page - 1) * limit)
        .take(limit)
        .getManyAndCount()

      return { data, total, page, limit }
    } catch (error) {
      this.logger.error('Failed to find translation logs', error)
      this.errorLogsService.logError({
        message: 'Failed to find translation logs',
        stackTrace: (error as Error).stack ?? null,
        path: 'translation_log',
      })
      throw error
    }
  }

  /**
   * Returns aggregate statistics for translation logs.
   * Single query approach — avoids 5 separate DB round-trips.
   */
  async getStats(): Promise<TranslationLogStats> {
    const result = await this.logRepository
      .createQueryBuilder('log')
      .select([
        'COUNT(*) AS totalRequests',
        "SUM(CASE WHEN log.status = 'success' THEN 1 ELSE 0 END) AS successCount",
        "SUM(CASE WHEN log.status = 'error' THEN 1 ELSE 0 END) AS errorCount",
        'SUM(CASE WHEN log.cache_read_tokens > 0 THEN 1 ELSE 0 END) AS cacheHits',
        'COALESCE(SUM(log.input_tokens), 0) AS totalInputTokens',
        'COALESCE(SUM(log.output_tokens), 0) AS totalOutputTokens',
        'COALESCE(SUM(log.cache_creation_tokens), 0) AS totalCacheCreationTokens',
        'COALESCE(SUM(log.cache_read_tokens), 0) AS totalCacheReadTokens',
        'COALESCE(AVG(log.duration_ms), 0) AS avgDurationMs',
      ])
      .getRawOne()

    const total = Number(result?.totalRequests ?? 0)
    const totalInputTokens = Number(result?.totalInputTokens ?? 0)
    const totalCacheReadTokens = Number(result?.totalCacheReadTokens ?? 0)
    const cacheHits = Number(result?.cacheHits ?? 0)

    return {
      totalRequests: total,
      successCount: Number(result?.successCount ?? 0),
      errorCount: Number(result?.errorCount ?? 0),
      cacheHitRate: total > 0 ? Math.round((cacheHits / total) * 100) : 0,
      tokensSavedRate:
        totalInputTokens > 0 ? Math.round((totalCacheReadTokens / totalInputTokens) * 100) : 0,
      avgDurationMs: Math.round(Number(result?.avgDurationMs ?? 0)),
      totalInputTokens,
      totalOutputTokens: Number(result?.totalOutputTokens ?? 0),
      totalCacheCreationTokens: Number(result?.totalCacheCreationTokens ?? 0),
      totalCacheReadTokens,
    }
  }

  /**
   * Returns cache hit rate broken down by source→target language pair.
   * Fetches logs with stats, then unnests target_langs JSON in JS
   * to avoid MariaDB JSON_TABLE compatibility issues.
   */
  async getCacheBreakdown(): Promise<CacheBreakdownItem[]> {
    const rows = await this.logRepository
      .createQueryBuilder('log')
      .select([
        'log.source_lang AS sourceLang',
        'log.target_langs AS targetLangs',
        'COUNT(*) AS totalRequests',
        'SUM(CASE WHEN log.cache_read_tokens > 0 THEN 1 ELSE 0 END) AS cacheHits',
        'COALESCE(AVG(log.duration_ms), 0) AS avgDurationMs',
        'COALESCE(SUM(log.input_tokens), 0) AS totalInputTokens',
        'COALESCE(SUM(log.cache_read_tokens), 0) AS totalCacheReadTokens',
      ])
      .groupBy('log.source_lang, log.target_langs')
      .orderBy('totalRequests', 'DESC')
      .getRawMany()

    // Aggregate by unnested (sourceLang, targetLang) pairs
    const aggregated = new Map<string, CacheBreakdownItem>()

    for (const row of rows) {
      const sourceLang = row.sourceLang
      const targetLangs: string[] = JSON.parse(row.targetLangs ?? '[]')

      for (const targetLang of targetLangs) {
        const key = `${sourceLang}→${targetLang}`
        const existing = aggregated.get(key)

        if (existing) {
          existing.totalRequests += Number(row.totalRequests)
          existing.cacheHits += Number(row.cacheHits)
          existing.totalInputTokens += Number(row.totalInputTokens)
          existing.totalCacheReadTokens += Number(row.totalCacheReadTokens)
          // Weighted average for duration
          existing.avgDurationMs = Math.round(
            (existing.avgDurationMs * (existing.totalRequests - Number(row.totalRequests)) +
              Math.round(Number(row.avgDurationMs)) * Number(row.totalRequests)) /
              existing.totalRequests,
          )
        } else {
          aggregated.set(key, {
            sourceLang,
            targetLang,
            totalRequests: Number(row.totalRequests),
            cacheHits: Number(row.cacheHits),
            cacheHitRate: 0,
            avgDurationMs: Math.round(Number(row.avgDurationMs)),
            totalInputTokens: Number(row.totalInputTokens),
            totalCacheReadTokens: Number(row.totalCacheReadTokens),
          })
        }
      }
    }

    // Calculate hit rates and sort by requests descending
    return Array.from(aggregated.values())
      .map((item) => ({
        ...item,
        cacheHitRate:
          item.totalRequests > 0 ? Math.round((item.cacheHits / item.totalRequests) * 100) : 0,
      }))
      .sort((itemA, itemB) => itemB.totalRequests - itemA.totalRequests)
  }

  /**
   * Deletes translation logs older than the specified number of days.
   */
  async purge(olderThanDays: number): Promise<number> {
    const cutoff = moment.utc().subtract(olderThanDays, 'days').toDate()
    const result = await this.logRepository.delete({
      createdAt: LessThan(cutoff),
    })

    return result.affected ?? 0
  }
}
