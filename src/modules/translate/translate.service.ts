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

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(TranslationCache)
    private readonly translationCacheRepository: Repository<TranslationCache>,
  ) {
    this.model = this.configService.get<string>('TRANSLATE_MODEL') ?? 'claude-haiku-4-5-20251001'
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY')

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
  ): Promise<Record<string, string>> {
    if (!this.client) return {}
    if (targetLangs.length === 0) return {}
    if (text.length < 3 || this.isOnlyEmoji(text)) return {}

    const glossarySection =
      glossaryTerms.length > 0
        ? `\n- Glossary terms (translate consistently): ${glossaryTerms.join(', ')}`
        : ''

    const systemPrompt = [
      `You are a professional translator. Translate the text inside <text> tags.`,
      `\n- Source language: ${sourceLang}`,
      `- Target languages: ${targetLangs.join(', ')}`,
      `\n- NEVER translate these IT terms, keep them as-is: ${IT_TERMS_PRESERVED}`,
      glossarySection,
      `\n- Return ONLY a valid JSON object with ISO 639-1 language codes as keys.`,
      `- No markdown, no code fences, no explanation — only raw JSON.`,
      `- Example format: {"en": "translated text", "ja": "翻訳されたテキスト", "vi": "văn bản đã dịch"}`,
    ].join('\n')

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 2048,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: `Translate to [${targetLangs.join(', ')}]:\n<text>${text}</text>\nFormat: {${targetLangs.map((lang) => `"${lang}": "..."`).join(', ')}}`,
          },
        ],
      })

      const block = response.content[0]
      const rawText = block.type === 'text' ? block.text.trim() : ''

      const cleaned = rawText
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim()
      const parsed = JSON.parse(cleaned) as Record<string, string>

      const result: Record<string, string> = {}

      for (const lang of targetLangs) {
        if (parsed[lang]) {
          result[lang] = parsed[lang]
        }
      }

      return result
    } catch (error) {
      this.logger.error('Failed to translate text', error)

      return {}
    }
  }

  async getOrCreateTranslations(
    messageId: number,
    content: string,
    sourceLang: string,
    targetLangs: string[],
    glossaryTerms: string[] = [],
  ): Promise<Record<string, string>> {
    if (targetLangs.length === 0) return {}

    const cached = await this.findCache(messageId)
    const cachedTranslations = cached?.translations ?? {}

    const missingLangs = targetLangs.filter((lang) => !cachedTranslations[lang])

    if (missingLangs.length === 0) {
      return this.pickTranslations(cachedTranslations, targetLangs)
    }

    const newTranslations = await this.translateToMultiple(
      content,
      sourceLang,
      missingLangs,
      glossaryTerms,
    )

    const merged = { ...cachedTranslations, ...newTranslations }

    try {
      if (cached) {
        cached.translations = merged
        await this.translationCacheRepository.save(cached)
      } else {
        const entry = this.translationCacheRepository.create({
          messageId,
          translations: merged,
        })
        await this.translationCacheRepository.save(entry)
      }
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

  private isOnlyEmoji(text: string): boolean {
    const stripped = text.replace(/\s/g, '')
    if (stripped.length === 0) return true
    const emojiRegex = /^[\p{Emoji_Presentation}\p{Extended_Pictographic}]+$/u

    return emojiRegex.test(stripped)
  }
}
