import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import Anthropic from '@anthropic-ai/sdk'
import { TranslationCache } from './entities/translation_cache.entity'

const IT_TERMS_PRESERVED = [
  'API',
  'SDK',
  'bug',
  'fix',
  'deploy',
  'staging',
  'production',
  'backend',
  'frontend',
  'database',
  'server',
  'cache',
  'debug',
  'commit',
  'merge',
  'PR',
  'branch',
  'Docker',
  'CI/CD',
  'login',
  'logout',
  'dashboard',
  'token',
  'session',
  'payload',
  'request',
  'response',
].join(', ')

@Injectable()
export class TranslateService {
  private readonly logger = new Logger(TranslateService.name)
  private client: Anthropic | null = null
  private model: string = 'claude-haiku-4-5-20251001'
  private maxTokens: number = 8192
  private maxInputLength: number = 5000

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(TranslationCache)
    private readonly translationCacheRepository: Repository<TranslationCache>,
  ) {
    this.model = this.configService.get<string>('TRANSLATE_MODEL') ?? 'claude-haiku-4-5-20251001'
    this.maxTokens = parseInt(this.configService.get<string>('TRANSLATE_MAX_TOKENS') ?? '8192', 10)
    this.maxInputLength = parseInt(
      this.configService.get<string>('TRANSLATE_MAX_INPUT_LENGTH') ?? '5000',
      10,
    )
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY')

    this.logger.log(
      `TranslateService init — model=${this.model} maxTokens=${this.maxTokens} maxInputLength=${this.maxInputLength} apiKey=${apiKey ? `set(${apiKey.slice(0, 12)}...)` : 'MISSING'}`,
    )

    if (!apiKey) {
      this.logger.warn('TranslateService disabled: ANTHROPIC_API_KEY is not set')

      return
    }

    this.client = new Anthropic({ apiKey })
  }

  async detectLanguage(text: string): Promise<string> {
    if (!this.client) {
      this.logger.warn('Anthropic client not initialized, defaulting to "en"')

      return 'en'
    }

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 10,
        system:
          'Detect the language of the provided text. Return ONLY the ISO 639-1 language code (e.g. vi, en, ja, ko, zh). No explanation, no punctuation, just the code.',
        messages: [{ role: 'user', content: text }],
      })

      const block = response.content[0]
      const languageCode = block.type === 'text' ? block.text.trim().toLowerCase() : 'en'

      return languageCode || 'en'
    } catch (error) {
      this.logger.error('Failed to detect language', error)

      return 'en'
    }
  }

  async translateToMultiple(
    text: string,
    sourceLang: string,
    targetLangs: string[],
    glossaryTerms: string[] = [],
    onChunk?: (lang: string, chunk: string) => void,
  ): Promise<Record<string, string>> {
    this.logger.log(
      `translateToMultiple — textLen=${text.length} src=${sourceLang} targets=${targetLangs.join(',')} client=${this.client ? 'ok' : 'NULL'}`,
    )

    if (!this.client) return {}
    if (targetLangs.length === 0) return {}
    if (text.length < 3 || this.isOnlyEmoji(text)) return {}

    // Single batch API call for all target languages — 1 round-trip instead of N
    const truncated =
      text.length > this.maxInputLength ? text.substring(0, this.maxInputLength) : text

    const glossarySection =
      glossaryTerms.length > 0
        ? `\n- Glossary terms (translate consistently): ${glossaryTerms.join(', ')}`
        : ''

    const systemPrompt = [
      `You are a professional translator. Translate the text inside <text> tags from ${sourceLang} to ALL of these languages: ${targetLangs.join(', ')}.`,
      `- NEVER translate these IT terms, keep them as-is: ${IT_TERMS_PRESERVED}`,
      glossarySection,
      `- Return a JSON object with language codes as keys and translations as values.`,
      `- Example: {"en": "Hello", "ja": "こんにちは"}`,
      `- Return ONLY the JSON, no explanation, no markdown, no code fences.`,
      `- Translate faithfully. Do NOT add, remove, or rephrase content.`,
      `- Keep ALL markdown formatting intact: @mentions, [link text](url), > blockquotes, **bold**, *italic*, \`code\`.`,
      `- Do NOT translate proper nouns, usernames, @mentions, URLs, ticket IDs (e.g. TB-123), or code snippets.`,
    ].join('\n')

    const result = await this.tryTranslateWithModel(
      this.model,
      truncated,
      targetLangs.join(','),
      systemPrompt,
      undefined,
    )

    if (!result) {
      this.logger.warn(
        'translateToMultiple — batch returned null, falling back to individual calls',
      )

      return this.translateToMultipleFallback(text, sourceLang, targetLangs, glossaryTerms, onChunk)
    }

    try {
      // Strip markdown code fences if present
      const cleaned = result
        .replace(/^```(?:json)?\s*\n?/m, '')
        .replace(/\n?```\s*$/m, '')
        .trim()
      const parsed = JSON.parse(cleaned) as Record<string, string>
      const merged: Record<string, string> = {}

      for (const lang of targetLangs) {
        if (parsed[lang]) merged[lang] = parsed[lang]
      }

      if (Object.keys(merged).length === 0) {
        this.logger.warn('translateToMultiple — batch JSON had no valid keys, falling back')

        return this.translateToMultipleFallback(
          text,
          sourceLang,
          targetLangs,
          glossaryTerms,
          onChunk,
        )
      }

      return merged
    } catch {
      this.logger.warn('translateToMultiple — failed to parse batch JSON, falling back')

      return this.translateToMultipleFallback(text, sourceLang, targetLangs, glossaryTerms, onChunk)
    }
  }

  private async translateToMultipleFallback(
    text: string,
    sourceLang: string,
    targetLangs: string[],
    glossaryTerms: string[],
    onChunk?: (lang: string, chunk: string) => void,
  ): Promise<Record<string, string>> {
    const results = await Promise.all(
      targetLangs.map((lang) =>
        this.translateToSingle(
          text,
          sourceLang,
          lang,
          glossaryTerms,
          onChunk ? (chunk) => onChunk(lang, chunk) : undefined,
        ),
      ),
    )

    const merged: Record<string, string> = {}

    for (let index = 0; index < targetLangs.length; index++) {
      const lang = targetLangs[index]
      const translation = results[index]

      if (lang && translation) merged[lang] = translation
    }

    return merged
  }

  private async translateToSingle(
    text: string,
    sourceLang: string,
    targetLang: string,
    glossaryTerms: string[] = [],
    onChunk?: (chunk: string) => void,
  ): Promise<string | null> {
    if (!this.client) return null

    const truncated =
      text.length > this.maxInputLength ? text.substring(0, this.maxInputLength) : text

    const glossarySection =
      glossaryTerms.length > 0
        ? `\n- Glossary terms (translate consistently): ${glossaryTerms.join(', ')}`
        : ''

    const systemPrompt = [
      `You are a professional translator. Translate the text inside <text> tags from ${sourceLang} to ${targetLang}.`,
      `- NEVER translate these IT terms, keep them as-is: ${IT_TERMS_PRESERVED}`,
      glossarySection,
      `- Return ONLY the translated text, no explanation, no markdown wrapper, no quotes.`,
      `- Keep ALL markdown formatting intact: @mentions, [link text](url), > blockquotes, **bold**, *italic*, \`code\`.`,
      `- Do NOT translate proper nouns, usernames, @mentions, URLs, ticket IDs (e.g. TB-123), or code snippets.`,
    ].join('\n')

    this.logger.log(
      `translateToSingle — target=${targetLang} len=${truncated.length} maxTokens=${this.maxTokens}`,
    )

    return this.tryTranslateWithModel(this.model, truncated, targetLang, systemPrompt, onChunk)
  }

  async getOrCreateTranslations(
    messageId: number,
    content: string,
    sourceLang: string,
    targetLangs: string[],
    glossaryTerms: string[] = [],
    onChunk?: (lang: string, chunk: string) => void,
    forceRefresh = false,
  ): Promise<Record<string, string>> {
    if (targetLangs.length === 0) return {}

    const cached = forceRefresh ? null : await this.findCache(messageId)
    const cachedTranslations = cached?.translations ?? {}

    const missingLangs = forceRefresh
      ? targetLangs
      : targetLangs.filter((lang) => !cachedTranslations[lang])

    if (missingLangs.length === 0) {
      return this.pickTranslations(cachedTranslations, targetLangs)
    }

    const newTranslations = await this.translateToMultiple(
      content,
      sourceLang,
      missingLangs,
      glossaryTerms,
      onChunk,
    )

    const merged = { ...cachedTranslations, ...newTranslations }

    try {
      // Use upsert to avoid unique constraint race conditions on concurrent edits
      await this.translationCacheRepository.upsert({ messageId, translations: merged }, [
        'messageId',
      ])
    } catch (error) {
      this.logger.error('Failed to save translation cache', error)
    }

    return this.pickTranslations(merged, targetLangs)
  }

  async invalidateCache(messageId: number): Promise<void> {
    try {
      await this.translationCacheRepository.delete({ messageId })
    } catch (error) {
      this.logger.error('Failed to invalidate translation cache', error)
    }
  }

  private async findCache(messageId: number): Promise<TranslationCache | null> {
    try {
      return await this.translationCacheRepository.findOneBy({ messageId })
    } catch (error) {
      this.logger.error('Failed to query translation cache', error)

      return null
    }
  }

  private pickTranslations(
    all: Record<string, string>,
    targetLangs: string[],
  ): Record<string, string> {
    const result: Record<string, string> = {}

    for (const lang of targetLangs) {
      if (all[lang]) {
        result[lang] = all[lang]
      }
    }

    return result
  }

  private async tryTranslateWithModel(
    model: string,
    text: string,
    targetLang: string,
    systemPrompt: string,
    onChunk?: (chunk: string) => void,
  ): Promise<string | null> {
    if (!this.client) return null

    const useStreaming = text.length > 1000
    const maxRetries = 2
    const requestPayload = {
      model,
      max_tokens: this.maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user' as const, content: `<text>${text}</text>` }],
    }

    this.logger.log(
      `translateToSingle — target=${targetLang} mode=${useStreaming ? 'stream' : 'sync'}`,
    )

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (useStreaming) {
          const stream = this.client.messages.stream(requestPayload, { timeout: 120_000 })

          let fullText = ''

          stream.on('text', (textDelta: string) => {
            fullText += textDelta
            onChunk?.(textDelta)
          })

          const finalMessage = await stream.finalMessage()

          this.logger.log(
            `translateToSingle done — target=${targetLang} stopReason=${finalMessage.stop_reason} resultLen=${fullText.length}`,
          )

          return fullText.trim() || null
        } else {
          const response = await this.client.messages.create(requestPayload, { timeout: 60_000 })
          const block = response.content[0]
          const result = block.type === 'text' ? block.text.trim() : null

          this.logger.log(
            `translateToSingle done — target=${targetLang} stopReason=${response.stop_reason} resultLen=${result?.length ?? 0}`,
          )

          return result || null
        }
      } catch (error) {
        const status = (error as { status?: number }).status
        const isRetryable = status === 529 || status === 503 || status === 429

        if (isRetryable && attempt < maxRetries) {
          const delay = Math.round(5000 + Math.random() * 3000)
          this.logger.warn(
            `translateToSingle HTTP ${status} — retry ${attempt}/${maxRetries - 1} in ${delay}ms`,
          )
          await new Promise((resolve) => setTimeout(resolve, delay))

          continue
        }

        this.logger.error(
          `translateToSingle failed — target=${targetLang} attempt=${attempt}: ${(error as Error).message}`,
        )

        return null
      }
    }

    return null
  }

  private isOnlyEmoji(text: string): boolean {
    const stripped = text.replace(/\s/g, '')
    if (stripped.length === 0) return true
    const emojiRegex = /^[\p{Emoji_Presentation}\p{Extended_Pictographic}]+$/u

    return emojiRegex.test(stripped)
  }
}
