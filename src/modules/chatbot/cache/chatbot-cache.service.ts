import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { createHash } from 'crypto'
import moment from 'moment'
import { ChatbotCacheEntry } from './entities/chatbot-cache-entry.entity'
import { ChatbotPromptSectionHash } from './entities/chatbot-prompt-section-hash.entity'
import { ErrorLogsService } from '@/modules/error_logs/error_logs.service'

@Injectable()
export class ChatbotCacheService {
  private readonly logger = new Logger(ChatbotCacheService.name)
  private readonly enabled: boolean
  private readonly ttlDays: number
  private readonly maxConvoLength: number
  private readonly ftsThreshold: number

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(ChatbotCacheEntry)
    private readonly cacheRepository: Repository<ChatbotCacheEntry>,
    @InjectRepository(ChatbotPromptSectionHash)
    private readonly sectionHashRepository: Repository<ChatbotPromptSectionHash>,
    private readonly errorLogsService: ErrorLogsService,
  ) {
    this.enabled = this.configService.get<string>('CHATBOT_CACHE_ENABLED') !== 'false'
    this.ttlDays = parseInt(this.configService.get<string>('CHATBOT_CACHE_TTL_DAYS') ?? '7', 10)
    this.maxConvoLength = parseInt(
      this.configService.get<string>('CHATBOT_CACHE_MAX_CONVO_LEN') ?? '5',
      10,
    )
    this.ftsThreshold = parseFloat(
      this.configService.get<string>('CHATBOT_CACHE_FTS_THRESHOLD') ?? '2.0',
    )

    this.logger.log(
      `ChatbotCache init — enabled=${this.enabled} ttl=${this.ttlDays}d maxConvo=${this.maxConvoLength} ftsThreshold=${this.ftsThreshold}`,
    )
  }

  /**
   * Checks if caching should be applied for the given conversation length.
   */
  shouldCache(conversationLength: number): boolean {
    return this.enabled && conversationLength <= this.maxConvoLength
  }

  /**
   * Looks up a cached response for the given query.
   * 1. Fast path: exact hash match on normalized query.
   * 2. Fallback: MariaDB full-text search for keyword-similar queries.
   */
  async lookup(
    query: string,
    role: string,
    tone: string,
  ): Promise<{ reply: string; suggestions: string[] } | null> {
    if (!this.enabled) return null

    try {
      const normalized = this.normalizeQuery(query)
      const queryHash = this.computeHash(normalized + '|' + role + '|' + tone)

      // Fast path: exact hash lookup
      const exact = await this.cacheRepository.findOne({
        where: { queryHash, role, tone },
      })

      if (exact && moment(exact.expiresAt).isAfter(moment())) {
        // Update hit stats (fire-and-forget)
        this.cacheRepository
          .createQueryBuilder()
          .update(ChatbotCacheEntry)
          .set({ hitCount: () => 'hit_count + 1', lastHitAt: () => 'NOW()' })
          .where('id = :id', { id: exact.id })
          .execute()
          .catch(() => {})

        this.logger.log(
          `Cache HIT (hash) — query="${query.substring(0, 50)}..." hits=${exact.hitCount + 1}`,
        )
        return { reply: exact.reply, suggestions: exact.suggestions }
      }

      // Fallback: full-text search
      const ftsResult = await this.fullTextSearch(normalized, role, tone)
      if (ftsResult) {
        this.logger.log(`Cache HIT (fts) — query="${query.substring(0, 50)}..."`)
        return { reply: ftsResult.reply, suggestions: ftsResult.suggestions }
      }

      this.logger.log(`Cache MISS — query="${query.substring(0, 50)}..."`)
      return null
    } catch (error) {
      this.logger.error('Cache lookup failed', error)
      return null
    }
  }

  /**
   * Saves a chatbot response to cache. Fire-and-forget — never blocks.
   */
  async save(
    query: string,
    reply: string,
    suggestions: string[],
    role: string,
    tone: string,
    language: string | undefined,
    sectionIds: string[],
    modelUsed: string,
  ): Promise<void> {
    if (!this.enabled) return

    try {
      const normalized = this.normalizeQuery(query)
      const queryHash = this.computeHash(normalized + '|' + role + '|' + tone)
      const expiresAt = moment().add(this.ttlDays, 'days').toDate()

      await this.cacheRepository
        .createQueryBuilder()
        .insert()
        .into(ChatbotCacheEntry)
        .values({
          queryHash,
          originalQuery: query,
          normalizedQuery: normalized,
          role,
          tone,
          language: language ?? null,
          reply,
          suggestions,
          sectionIds,
          modelUsed,
          expiresAt,
        })
        .orUpdate(
          [
            'original_query',
            'normalized_query',
            'reply',
            'suggestions',
            'section_ids',
            'model_used',
            'expires_at',
            'hit_count',
          ],
          ['query_hash', 'role', 'tone'],
        )
        .execute()
    } catch (error) {
      this.logger.error('Failed to save cache entry', error)
      this.errorLogsService.logError({
        message: 'Failed to save chatbot cache entry',
        stackTrace: (error as Error).stack ?? null,
        path: 'chatbot_cache',
      })
    }
  }

  /**
   * Computes content hashes for all current prompt sections,
   * compares with stored hashes, and invalidates cache entries
   * that depend on changed sections.
   * Returns the list of changed section IDs.
   */
  async syncSectionHashesAndGetChanged(
    currentSections: Array<{ id: string; body: string }>,
  ): Promise<string[]> {
    try {
      // Compute new hashes
      const newHashes = new Map<string, string>()
      for (const section of currentSections) {
        newHashes.set(section.id, this.computeHash(section.body))
      }

      // Load old hashes
      const oldEntries = await this.sectionHashRepository.find()
      const oldHashes = new Map<string, string>()
      for (const entry of oldEntries) {
        oldHashes.set(entry.sectionId, entry.contentHash)
      }

      // Diff: find changed sections
      const changedSectionIds: string[] = []
      for (const [sectionId, newHash] of newHashes) {
        const oldHash = oldHashes.get(sectionId)
        if (oldHash !== newHash) {
          changedSectionIds.push(sectionId)
        }
      }

      // Also detect deleted sections (in old but not in new)
      for (const oldSectionId of oldHashes.keys()) {
        if (!newHashes.has(oldSectionId)) {
          changedSectionIds.push(oldSectionId)
        }
      }

      // Save new hashes (upsert)
      for (const [sectionId, contentHash] of newHashes) {
        await this.sectionHashRepository
          .createQueryBuilder()
          .insert()
          .into(ChatbotPromptSectionHash)
          .values({ sectionId, contentHash })
          .orUpdate(['content_hash'], ['section_id'])
          .execute()
      }

      // Invalidate cache entries affected by changed sections
      if (changedSectionIds.length > 0) {
        const deletedCount = await this.invalidateByChangedSections(changedSectionIds)
        this.logger.log(
          `Prompt sections changed: [${changedSectionIds.join(', ')}] — ${deletedCount} cache entries invalidated`,
        )
      } else {
        this.logger.log('No prompt section changes detected — cache intact')
      }

      return changedSectionIds
    } catch (error) {
      this.logger.error('Failed to sync section hashes', error)
      this.errorLogsService.logError({
        message: 'Failed to sync chatbot prompt section hashes',
        stackTrace: (error as Error).stack ?? null,
        path: 'chatbot_cache',
      })
      return []
    }
  }

  /**
   * Deletes cache entries whose section_ids JSON contains any of the changed section IDs.
   */
  private async invalidateByChangedSections(changedSectionIds: string[]): Promise<number> {
    if (changedSectionIds.length === 0) return 0

    let totalDeleted = 0

    for (const sectionId of changedSectionIds) {
      const result = await this.cacheRepository
        .createQueryBuilder()
        .delete()
        .where('section_ids LIKE :pattern', { pattern: `%"${sectionId}"%` })
        .execute()
      totalDeleted += result.affected ?? 0
    }

    return totalDeleted
  }

  /**
   * Removes expired cache entries. Called periodically.
   */
  async purgeExpired(): Promise<number> {
    try {
      const result = await this.cacheRepository
        .createQueryBuilder()
        .delete()
        .where('expires_at < NOW()')
        .execute()

      const deleted = result.affected ?? 0
      if (deleted > 0) {
        this.logger.log(`Purged ${deleted} expired cache entries`)
      }

      return deleted
    } catch (error) {
      this.logger.error('Failed to purge expired cache entries', error)
      return 0
    }
  }

  /**
   * Normalizes a user query for consistent hashing.
   * - Lowercase
   * - Remove punctuation
   * - Remove Vietnamese/Japanese sentence-ending particles
   * - Collapse common phrasing patterns
   */
  private normalizeQuery(query: string): string {
    const normalized = query
      .toLowerCase()
      .trim()
      // Remove punctuation
      .replace(/[。！？、,.!?;:…]/g, ' ')
      // Remove Vietnamese particles at end
      .replace(/\s+(nha|nhé|nè|ha|nhỉ|đi|với|nào|thôi|ạ|được không|không)$/g, '')
      // Remove Japanese particles at end
      .replace(/\s+(ね|よ|さ|な|か|の|かい|だね|だよ)$/g, '')
      // Normalize common phrasing patterns
      .replace(
        /^(how do i |how to |how can i |can i |cách |làm sao để |làm sao |cho mình hỏi |mình muốn |tôi muốn |cho tôi hỏi )/g,
        '',
      )
      .replace(/^(what is |what are |what's |là gì|what does )/g, '')
      // Collapse whitespace
      .replace(/\s+/g, ' ')
      .trim()

    return normalized
  }

  private computeHash(input: string): string {
    return createHash('sha256').update(input).digest('hex')
  }

  /**
   * Fallback semantic matching using MariaDB full-text search.
   * Returns the best matching entry if score exceeds threshold.
   */
  private async fullTextSearch(
    normalized: string,
    role: string,
    tone: string,
  ): Promise<ChatbotCacheEntry | null> {
    try {
      const result = await this.cacheRepository
        .createQueryBuilder('entry')
        .select('entry.*')
        .addSelect('MATCH(entry.normalized_query) AGAINST (:query IN BOOLEAN MODE)', 'score')
        .where('entry.role = :role', { role })
        .andWhere('entry.tone = :tone', { tone })
        .andWhere('entry.expires_at > NOW()')
        .andWhere('MATCH(entry.normalized_query) AGAINST (:query IN BOOLEAN MODE)')
        .orderBy('score', 'DESC')
        .limit(1)
        .setParameters({ query: normalized })
        .getRawOne()

      if (!result) return null

      const score = parseFloat(result.score ?? '0')
      if (score < this.ftsThreshold) return null

      // Map raw result to entity shape
      return {
        id: result.id,
        reply: result.reply,
        suggestions: JSON.parse(result.suggestions ?? '[]'),
        hitCount: result.hit_count,
      } as ChatbotCacheEntry
    } catch (error) {
      this.logger.warn('Full-text search failed', error)
      return null
    }
  }
}
