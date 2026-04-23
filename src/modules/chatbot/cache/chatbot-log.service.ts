import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, LessThan } from 'typeorm'
import moment from 'moment'
import { ChatbotLog } from './entities/chatbot-log.entity'
import { ErrorLogsService } from '@/modules/error_logs/error_logs.service'

export interface ChatbotLogEntry {
  queryHash?: string
  role: string
  tone: string
  language?: string
  status: 'cache_hit' | 'cache_miss' | 'error' | 'rejected'
  inputTokens?: number
  outputTokens?: number
  cacheLookupMs?: number
  apiCallMs?: number
  modelUsed?: string
  errorMessage?: string
}

export interface ChatbotLogStats {
  totalRequests: number
  cacheHits: number
  cacheMisses: number
  errors: number
  cacheHitRate: number
  estimatedSavedUsd: number
  avgCacheLookupMs: number
  avgApiCallMs: number
  totalInputTokens: number
  totalOutputTokens: number
}

@Injectable()
export class ChatbotLogService {
  private readonly logger = new Logger(ChatbotLogService.name)

  constructor(
    @InjectRepository(ChatbotLog)
    private readonly logRepository: Repository<ChatbotLog>,
    private readonly errorLogsService: ErrorLogsService,
  ) {}

  /**
   * Logs a chatbot request. Fire-and-forget — never throws.
   */
  async log(entry: ChatbotLogEntry): Promise<void> {
    try {
      await this.logRepository.save({
        queryHash: entry.queryHash,
        role: entry.role,
        tone: entry.tone,
        language: entry.language,
        status: entry.status,
        inputTokens: entry.inputTokens,
        outputTokens: entry.outputTokens,
        cacheLookupMs: entry.cacheLookupMs,
        apiCallMs: entry.apiCallMs,
        modelUsed: entry.modelUsed,
        errorMessage: entry.errorMessage,
      })
    } catch (error) {
      this.logger.error('Failed to save chatbot log', error)
      this.errorLogsService.logError({
        message: 'Failed to save chatbot log',
        stackTrace: (error as Error).stack ?? null,
        path: 'chatbot_log',
      })
    }
  }

  /**
   * Returns aggregate stats. Single query approach.
   */
  async getStats(): Promise<ChatbotLogStats> {
    const result = await this.logRepository
      .createQueryBuilder('log')
      .select([
        'COUNT(*) AS totalRequests',
        "SUM(CASE WHEN log.status = 'cache_hit' THEN 1 ELSE 0 END) AS cacheHits",
        "SUM(CASE WHEN log.status = 'cache_miss' THEN 1 ELSE 0 END) AS cacheMisses",
        "SUM(CASE WHEN log.status = 'error' THEN 1 ELSE 0 END) AS errors",
        'COALESCE(SUM(log.input_tokens), 0) AS totalInputTokens',
        'COALESCE(SUM(log.output_tokens), 0) AS totalOutputTokens',
        "COALESCE(AVG(CASE WHEN log.status = 'cache_hit' THEN log.cache_lookup_ms END), 0) AS avgCacheLookupMs",
        "COALESCE(AVG(CASE WHEN log.status = 'cache_miss' THEN log.api_call_ms END), 0) AS avgApiCallMs",
      ])
      .getRawOne()

    const total = Number(result?.totalRequests ?? 0)
    const cacheHits = Number(result?.cacheHits ?? 0)
    const totalInputTokens = Number(result?.totalInputTokens ?? 0)
    const totalOutputTokens = Number(result?.totalOutputTokens ?? 0)

    // Estimated savings: cache_hit means we skipped a Sonnet call.
    // Sonnet input: $3/MTok, output: $15/MTok. Average chatbot call ≈ 17000 input + 500 output tokens.
    const avgInputPerCall =
      total > 0 ? Math.round(totalInputTokens / (total - cacheHits || 1)) : 17000
    const avgOutputPerCall =
      total > 0 ? Math.round(totalOutputTokens / (total - cacheHits || 1)) : 500
    const savedInputCost = (cacheHits * avgInputPerCall * 3) / 1_000_000
    const savedOutputCost = (cacheHits * avgOutputPerCall * 15) / 1_000_000

    return {
      totalRequests: total,
      cacheHits,
      cacheMisses: Number(result?.cacheMisses ?? 0),
      errors: Number(result?.errors ?? 0),
      cacheHitRate: total > 0 ? Math.round((cacheHits / total) * 100) : 0,
      estimatedSavedUsd: Math.round((savedInputCost + savedOutputCost) * 100) / 100,
      avgCacheLookupMs: Math.round(Number(result?.avgCacheLookupMs ?? 0)),
      avgApiCallMs: Math.round(Number(result?.avgApiCallMs ?? 0)),
      totalInputTokens,
      totalOutputTokens,
    }
  }

  /**
   * Paginated log listing with optional date filter.
   */
  async findAll(query: {
    page?: number
    limit?: number
    dateFrom?: string
    dateTo?: string
  }): Promise<{ data: ChatbotLog[]; total: number; page: number; limit: number }> {
    const page = query.page ?? 1
    const limit = query.limit ?? 50
    const qb = this.logRepository.createQueryBuilder('log').orderBy('log.created_at', 'DESC')

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
  }

  /**
   * Deletes logs older than the specified number of days.
   */
  async purge(olderThanDays: number): Promise<number> {
    const cutoff = moment.utc().subtract(olderThanDays, 'days').toDate()
    const result = await this.logRepository.delete({ createdAt: LessThan(cutoff) })

    return result.affected ?? 0
  }
}
