import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import Anthropic from '@anthropic-ai/sdk'
import moment from 'moment'
import { TranslationCache } from './entities/translation_cache.entity'
import { TranslationLogService } from './translation-log.service'

// IT/dev terms that must stay as-is. Exclude common English words (request, session, token)
// that have natural translations in conversational context.
const IT_TERMS_PRESERVED =
  'API, SDK, bug, fix, deploy, staging, production, backend, frontend, database, server, cache, debug, commit, merge, PR, branch, Docker, CI/CD, dashboard'

// Attendance-domain terms that must stay as-is — they are app-specific labels.
const ATTENDANCE_TERMS_PRESERVED = 'WFH, check-in, check-out, clock-in, clock-out, overtime'

type MessageIntent = 'caring' | 'technical' | 'neutral'

/**
 * Detects the intent of a message to decide which style rules to apply post-translation.
 * Runs on the original source text before any LLM call.
 */
function detectIntent(text: string): MessageIntent {
  const lower = text.toLowerCase()

  const caringKeywords = [
    'sức khoẻ',
    'sức khỏe',
    'nghỉ ngơi',
    'nghỉ ngơi',
    'chăm sóc',
    'khoẻ mạnh',
    'khỏe mạnh',
    'health',
    'rest',
    'take care',
    'get well',
    'feel better',
    'recover',
    '健康',
    '休',
    '体',
    'お大事',
    '気をつけ',
  ]

  const technicalKeywords = [
    'api',
    'bug',
    'error',
    'deploy',
    'fix',
    'merge',
    'commit',
    'staging',
    'production',
    'server',
    'database',
    'ci/cd',
    'docker',
    'build',
    'crash',
    'log',
    'debug',
  ]

  if (caringKeywords.some((keyword) => lower.includes(keyword))) return 'caring'
  if (technicalKeywords.some((keyword) => lower.includes(keyword))) return 'technical'

  return 'neutral'
}

type JapaneseTone = 'casual' | 'polite'

interface PhrasePool {
  casual: string[]
  polite: string[]
}

// Each cluster has casual and polite variants — selection matches the detected output tone.
// Add more entries to any pool to increase variation over time.
const JA_PHRASE_POOLS: Record<string, PhrasePool> = {
  takecare: {
    polite: [
      'お体に気をつけてくださいね',
      '無理しないでくださいね',
      '体調に気をつけてくださいね',
      'ご自愛くださいね',
    ],
    casual: ['体に気をつけてね', '無理しないでね', '体調に気をつけてね', '体を大事にしてね'],
  },
  stayHealthy: {
    polite: [
      '元気でいてくださいね',
      'ずっと元気でいてくださいね',
      '元気でいてもらえると嬉しいです',
      'いつも元気でいられるといいですね',
    ],
    casual: ['元気でいてね', 'ずっと元気でいてね', '元気でいてくれると嬉しいな', 'いつも元気でね'],
  },
  help: {
    polite: [
      '困ったことがあればいつでも声をかけてください',
      '何かあればいつでも頼ってくださいね',
      '遠慮なく言ってくださいね',
    ],
    casual: [
      '困ったことがあればいつでも声かけてね',
      '何かあったらいつでも頼ってね',
      '遠慮なく言ってね',
    ],
  },
  rest: {
    polite: [
      'ゆっくり休んでくださいね',
      'しっかり休んでくださいね',
      '無理せずゆっくり休んでください',
    ],
    casual: ['ゆっくり休んでね', 'しっかり休んでね', '無理せず休んでね'],
  },
}

function pickRandom(pool: string[]): string {
  return pool[Math.floor(Math.random() * pool.length)] ?? (pool[0] as string)
}

function pickFromPool(pool: PhrasePool, tone: JapaneseTone): string {
  return pickRandom(pool[tone])
}

/**
 * Detects whether the LLM-generated Japanese output is casual or polite.
 * Used to select matching phrase variants and normalize tone consistency.
 */
function detectJapaneseTone(text: string): JapaneseTone {
  const politeCount = (text.match(/(?:ます|です)[。！？\s]|ください|でしょう|いたします/g) ?? [])
    .length
  const casualCount = (
    text.match(/[ねよな][。！？\s]|だね|だよ|じゃん|[るくい]よ[。！]|てる[。！\s]/g) ?? []
  ).length

  return politeCount >= casualCount ? 'polite' : 'casual'
}

/**
 * Normalizes leftover tone inconsistencies after phrase replacement.
 * Only called for 'caring' intent. Does NOT perform full morphological rewriting —
 * targets the most common mixing pattern (〜てください after casual context).
 */
function normalizeMixedTone(text: string, tone: JapaneseTone): string {
  if (tone === 'casual') {
    return text.replace(/てくださいね[。！]/g, 'てね。').replace(/てください[。！]/g, 'てね。')
  }

  return text
}

/**
 * Applies intent-aware post-processing to Japanese translation output.
 * Only called when targetLang is Japanese.
 *
 * - 'caring': strip あなた + tone-matched phrase variation + tone normalization
 * - 'technical': strip あなた only — do NOT modify style
 * - 'neutral': strip あなた only
 */
function applyJapaneseStyleRules(text: string, intent: MessageIntent): string {
  // Always: strip unnatural subject pronouns (all intents)
  let result = text
    .replace(/あなたは?\s*/g, '')
    .replace(/あなたも?\s*/g, '')
    .replace(/君は?\s*/g, '')
    .replace(/君も?\s*/g, '')

  if (intent !== 'caring') {
    return result.replace(/\s{2,}/g, ' ').trim()
  }

  // Detect tone of LLM output — select phrase variants accordingly
  const tone = detectJapaneseTone(result)

  // Context-aware replacement: 大切にしてください only when health/body context is present
  result = result.replace(/大切にしてください/g, (match, _offset, full: string) => {
    if (/健康|体|お体|元気/.test(full)) return pickFromPool(JA_PHRASE_POOLS.takecare, tone)
    return match
  })

  result = result
    .replace(/支援が必要な時は/g, () => pickFromPool(JA_PHRASE_POOLS.help, tone))
    .replace(/サポートが必要なら/g, () => pickFromPool(JA_PHRASE_POOLS.help, tone))
    .replace(/いつも(?:元気|健康)でいてください(?!ね)/g, () =>
      pickFromPool(JA_PHRASE_POOLS.stayHealthy, tone),
    )
    .replace(/ゆっくり休んでください(?!ね)/g, () => pickFromPool(JA_PHRASE_POOLS.rest, tone))

  // Fix remaining tone inconsistencies introduced by LLM or earlier replacements
  result = normalizeMixedTone(result, tone)

  return result.replace(/\s{2,}/g, ' ').trim()
}

/**
 * Static translation rules that never change between calls.
 * Cached by Anthropic prompt caching — reused across ALL translation requests
 * regardless of source/target language or glossary.
 */
const STATIC_TRANSLATION_RULES = [
  `- PRIORITY: Translate NATURALLY, not literally. Rewrite to sound like a native speaker.`,
  `- Avoid word-for-word translation. You may restructure the sentence completely.`,
  `- NATURALIZATION RULE: If the output sounds like a translation, rewrite it until it reads as if a native speaker wrote it from scratch. Full sentence restructuring is allowed and encouraged.`,
  `- Tone: casual→warm/friendly, formal→professional. Never make casual stiff.`,
  `- VI casual: use "bạn/mình", not "tôi".`,
  `- JA HARD RULES (STRICT):`,
  `  • NEVER output "あなた" or "君" under ANY circumstance — Vietnamese "bạn/em/anh/chị" and English "you" MUST be rendered by omitting the subject entirely, not by translating to あなた/君`,
  `      BAD: あなたはこのテーブルのことを言っていますか？`,
  `      GOOD: このテーブルのことですか？`,
  `  • NEVER use masculine first-person "僕" or "俺" — omit subject or use "私" only if required`,
  `  • NEVER use kinship terms (姉さん/お兄さん etc.) for workplace address — omit or use person's name`,
  `  • Casual source → casual Japanese output. NEVER use formal vocabulary in casual chat:`,
  `      BAD: 非常に難しいです / 言及していますか / その通りです`,
  `      GOOD: かなり難しいですね / そのことですか？ / そうですよ`,
  `  • Prefer natural Japanese over literal translation`,
  `  • Merge clauses with て/から/し instead of writing two short sentences`,
  `  • Use soft outward tone (〜くださいね / 〜といいですね / 〜ほしいです)`,
  `  • Replace unnatural phrases:`,
  `      - 大切にしてください → お体に気をつけてください`,
  `      - 支援が必要な時は / 助けが必要 → 困ったことがあれば`,
  `      - サポートが必要なら → 気軽に声をかけてください`,
  `      - 疲れているように見える → なんか疲れてそう / お疲れじゃない？`,
  `      - 早く元気になってほしい / もらいたい → 早く良くなるといいね`,
  `      - すごく心配している (casual) → 大丈夫？ + 気になってたんだけど`,
  `- JA STYLE UPGRADE (caring tone only):`,
  `  • You MAY add natural nuance: 気軽に / といいですね / どうか`,
  `  • NEVER use もらいたいです for recovery or health wishes — it frames the speaker's desire, not the other person's wellbeing`,
  `  • NEVER use ぜひ with negative requests (〜ないでね / 〜ないでください) — ぜひ is for positive requests only`,
  `  • Add nuance only where it flows naturally — do NOT overuse`,
  `- BAD example (DO NOT DO):`,
  `  • あなたもお体に気をつけてください`,
  `  • 疲れているように見えるよ。ゆっくり休んでね。 (literal + segmented)`,
  `  • 早く元気になってもらいたいです。 (speaker-centric framing)`,
  `- GOOD example:`,
  `  • ちょっとお疲れみたいだし、無理せずゆっくり休んでね。`,
  `  • 困ったことがあれば気軽に声をかけてね。早く良くなるといいね🙏`,
  `- Avoid unnatural Japanese:`,
  `  • 大切にしてください (for health context)`,
  `  • 疲れているように見える (for "you look tired" context)`,
  `  • もらいたいです for recovery/health wishing`,
  `- JA fixed phrases: よろしくお願いします="Thanks in advance"; かしこまりました="Certainly"; お疲れ様です="Good work"`,
  `- Keep as-is: ${IT_TERMS_PRESERVED}; ${ATTENDANCE_TERMS_PRESERVED}`,
  `- Profanity → replace with [***], do not translate vulgarity`,
  `- Keep ALL emojis exactly as-is — do NOT remove, replace, or convert them:`,
  `  • Unicode emoji (🙏😅🎉) → keep exactly`,
  `  • Custom emoji codes (:blob-sob: :yoyo-haha: :any-word:) → keep EXACTLY including the colons — NEVER convert to Unicode`,
  `- Script purity: output language must use ONLY that script — never mix scripts (e.g., no Japanese/Chinese characters inside Vietnamese or English output). If a term cannot be translated, use the closest equivalent or romanize it — NEVER keep original script characters.`,
  `- Keep markdown: @mentions, links, code`,
  `- Do NOT translate proper nouns, URLs, ticket IDs`,
  `- Translate ONLY what is in the source — do NOT add phrases, sentences, or emoji not present in the original`,
  `- FINAL SELF-CHECK (MANDATORY before output):`,
  `  • Does this sound like a native speaker wrote it?`,
  `  • Is there any "translated feeling"? → rewrite if yes`,
  `  • Are short clauses merged into one natural sentence instead of two flat ones?`,
  `  • Is the emotional weight appropriate? (workplace casual = light, not dramatic)`,
  `  • Ensure NO "あなた" or "君" exists — if found, rewrite with implicit subject`,
  `  • If any check fails → rewrite before returning`,
  `- TRANSLATION QUALITY STANDARDS:`,
  `  • Accuracy: preserve meaning, intent, and emotional tone exactly`,
  `  • Fluency: output must read as natural native speech, not a translation`,
  `  • Consistency: same terms translated the same way throughout the conversation`,
  `  • Register: match the formality level and social register of the source message`,
  `  • Completeness: never omit or add content — translate exactly what is present`,
  `  • Context awareness: use surrounding context to resolve ambiguous words`,
].join('\n')

/**
 * Builds the translation system prompt as content blocks for Anthropic prompt caching.
 * - Block 1: static rules (cached, ~90% of prompt tokens, reused across ALL calls)
 * - Block 2: dynamic context per request (source/target language, glossary, output format)
 */
function buildTranslationSystemBlocks(
  sourceLang: string,
  targetDescription: string,
  outputInstruction: string,
  glossarySection: string,
  cachePrompt: boolean,
): Array<{ type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }> {
  const dynamicLines = [
    `Workplace chat translator. Messages mix work and casual conversation. Translate from ${sourceLang} to ${targetDescription}.`,
    glossarySection,
    `- Return format strictly: ${outputInstruction}`,
  ]
    .filter(Boolean)
    .join('\n')

  return [
    {
      type: 'text',
      text: STATIC_TRANSLATION_RULES,
      ...(cachePrompt ? { cache_control: { type: 'ephemeral' } } : {}),
    },
    {
      type: 'text',
      text: dynamicLines,
    },
  ]
}

@Injectable()
export class TranslateService {
  private readonly logger = new Logger(TranslateService.name)
  private client: Anthropic | null = null
  private model: string = 'claude-haiku-4-5-20251001'
  private maxTokens: number = 8192
  private maxInputLength: number = 5000
  private cachePrompt: boolean = true

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(TranslationCache)
    private readonly translationCacheRepository: Repository<TranslationCache>,
    private readonly translationLogService: TranslationLogService,
  ) {
    this.model = this.configService.get<string>('TRANSLATE_MODEL') ?? 'claude-haiku-4-5-20251001'
    this.maxTokens = parseInt(this.configService.get<string>('TRANSLATE_MAX_TOKENS') ?? '8192', 10)
    this.maxInputLength = parseInt(
      this.configService.get<string>('TRANSLATE_MAX_INPUT_LENGTH') ?? '5000',
      10,
    )
    this.cachePrompt = this.configService.get<string>('TRANSLATE_CACHE_PROMPT') !== 'false'
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY')

    this.logger.log(
      `TranslateService init — model=${this.model} maxTokens=${this.maxTokens} maxInputLength=${this.maxInputLength} cachePrompt=${this.cachePrompt} apiKey=${apiKey ? `set(${apiKey.slice(0, 12)}...)` : 'MISSING'}`,
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
        system: [
          'Detect the language of the provided text. Return ONLY the ISO 639-1 language code (e.g. vi, en, ja, ko, zh). No explanation, no punctuation, just the code.',
          'CRITICAL: Japanese (ja) and Chinese (zh) disambiguation rules:',
          '- If the text contains ANY hiragana (あいうえお etc.) or katakana (アイウエオ etc.) characters → ALWAYS return "ja", never "zh".',
          '- Japanese business messages (です、ます、ください、おねがい etc.) are always "ja".',
          '- Return "zh" ONLY when you are certain the text is Chinese with no Japanese kana characters.',
        ].join('\n'),
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
    messageId?: number,
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
        ? `- Glossary (translate consistently): ${glossaryTerms.join(', ')}`
        : ''

    const systemBlocks = buildTranslationSystemBlocks(
      sourceLang,
      `ALL of: ${targetLangs.join(', ')}`,
      `- Return JSON {"lang":"translation",...}. ONLY JSON, no markdown, no explanation.`,
      glossarySection,
      this.cachePrompt,
    )

    // Cap max_tokens dynamically — output is bounded by input size (2 langs ≈ 3× input chars)
    const dynamicMaxTokens = Math.min(this.maxTokens, Math.ceil(truncated.length * 3) + 300)

    const result = await this.tryTranslateWithModel(
      this.model,
      truncated,
      targetLangs.join(','),
      systemBlocks,
      undefined,
      dynamicMaxTokens,
      { messageId, sourceLang, targetLangs },
    )

    if (!result) {
      this.logger.warn(
        'translateToMultiple — batch returned null, falling back to individual calls',
      )

      return this.translateToMultipleFallback(
        text,
        sourceLang,
        targetLangs,
        glossaryTerms,
        onChunk,
        messageId,
      )
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
    messageId?: number,
  ): Promise<Record<string, string>> {
    const results = await Promise.all(
      targetLangs.map((lang) =>
        this.translateToSingle(
          text,
          sourceLang,
          lang,
          glossaryTerms,
          onChunk ? (chunk) => onChunk(lang, chunk) : undefined,
          messageId,
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
    messageId?: number,
  ): Promise<string | null> {
    if (!this.client) return null

    const truncated =
      text.length > this.maxInputLength ? text.substring(0, this.maxInputLength) : text

    const glossarySection =
      glossaryTerms.length > 0
        ? `- Glossary (translate consistently): ${glossaryTerms.join(', ')}`
        : ''

    const systemBlocks = buildTranslationSystemBlocks(
      sourceLang,
      targetLang,
      `- Return ONLY the translated text, no explanation, no markdown wrapper, no quotes.`,
      glossarySection,
      this.cachePrompt,
    )

    const dynamicMaxTokens = Math.min(this.maxTokens, Math.ceil(truncated.length * 1.5) + 200)

    this.logger.log(
      `translateToSingle — target=${targetLang} len=${truncated.length} maxTokens=${dynamicMaxTokens}`,
    )

    return this.tryTranslateWithModel(
      this.model,
      truncated,
      targetLang,
      systemBlocks,
      onChunk,
      dynamicMaxTokens,
      { messageId, sourceLang, targetLangs: [targetLang] },
    )
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
      messageId,
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
    systemBlocks: Array<{ type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }>,
    onChunk?: (chunk: string) => void,
    maxTokens?: number,
    logContext?: { messageId?: number; sourceLang: string; targetLangs: string[] },
  ): Promise<string | null> {
    if (!this.client) return null

    const startTime = moment().valueOf()
    const useStreaming = text.length > 1000
    const maxRetries = 2
    const requestPayload = {
      model,
      max_tokens: maxTokens ?? this.maxTokens,
      system: systemBlocks,
      messages: [{ role: 'user' as const, content: `<text>${text}</text>` }],
    }
    const isJapaneseTarget = targetLang.includes('ja')
    const intent = isJapaneseTarget ? detectIntent(text) : 'neutral'

    this.logger.log(
      `translateToSingle — target=${targetLang} intent=${intent} mode=${useStreaming ? 'stream' : 'sync'}`,
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

          this.logCacheUsage(finalMessage.usage)

          this.logger.log(
            `translateToSingle done — target=${targetLang} stopReason=${finalMessage.stop_reason} resultLen=${fullText.length}`,
          )

          const streamResult = fullText.trim() || null

          this.fireAndForgetSessionLog({
            logContext,
            inputLength: text.length,
            usage: finalMessage.usage,
            model,
            startTime,
            mode: 'stream',
            error: undefined,
          })

          return streamResult && isJapaneseTarget
            ? applyJapaneseStyleRules(streamResult, intent)
            : streamResult
        } else {
          const response = await this.client.messages.create(requestPayload, { timeout: 60_000 })

          this.logCacheUsage(response.usage)

          const block = response.content[0]
          const rawResult = block.type === 'text' ? block.text.trim() : null

          this.logger.log(
            `translateToSingle done — target=${targetLang} stopReason=${response.stop_reason} resultLen=${rawResult?.length ?? 0}`,
          )

          this.fireAndForgetSessionLog({
            logContext,
            inputLength: text.length,
            usage: response.usage,
            model,
            startTime,
            mode: 'sync',
            error: undefined,
          })

          return rawResult && isJapaneseTarget
            ? applyJapaneseStyleRules(rawResult, intent)
            : rawResult
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

        this.fireAndForgetSessionLog({
          logContext,
          inputLength: text.length,
          usage: undefined,
          model,
          startTime,
          mode: useStreaming ? 'stream' : 'sync',
          error: (error as Error).message,
        })

        return null
      }
    }

    return null
  }

  /**
   * Fire-and-forget DB log write — never blocks or throws.
   */
  private fireAndForgetSessionLog(parameters: {
    logContext?: { messageId?: number; sourceLang: string; targetLangs: string[] }
    inputLength: number
    usage: Anthropic.Messages.Usage | undefined
    model: string
    startTime: number
    mode: 'sync' | 'stream'
    error: string | undefined
  }): void {
    if (!parameters.logContext) return

    const { logContext, inputLength, usage, model, startTime, mode, error } = parameters

    // Fire-and-forget — do not await
    this.translationLogService
      .logTranslation({
        messageId: logContext.messageId,
        sourceLang: logContext.sourceLang,
        targetLangs: logContext.targetLangs,
        inputLength,
        status: error ? 'error' : 'success',
        errorMessage: error,
        inputTokens: usage?.input_tokens,
        outputTokens: usage?.output_tokens,
        cacheCreationTokens: usage?.cache_creation_input_tokens,
        cacheReadTokens: usage?.cache_read_input_tokens,
        modelUsed: model,
        durationMs: moment().valueOf() - startTime,
        mode,
      })
      .catch(() => {
        /* silently ignore — logged inside logTranslation */
      })
  }

  private logCacheUsage(usage: Anthropic.Messages.Usage | undefined): void {
    if (!usage) return

    const created = usage.cache_creation_input_tokens ?? 0
    const read = usage.cache_read_input_tokens ?? 0

    if (created > 0) {
      this.logger.log(`prompt cache MISS — wrote ${created} tokens to cache`)
    } else if (read > 0) {
      this.logger.log(`prompt cache HIT — read ${read} tokens from cache`)
    } else {
      this.logger.warn(`prompt cache BYPASS — no cache tokens (prompt may be below 1024 threshold)`)
    }
  }

  /**
   * Returns true when the text has enough translatable content to justify an API call.
   * Skips messages that are:
   * - Too short (< 3 non-whitespace chars)
   * - Emoji-only
   * - Spam / test / meaningless (repetitive chars, test keywords, repeated single word)
   * - Contain no Unicode letters (pure numbers, punctuation, symbols)
   * - Contain only code with no natural-language words outside of code blocks/inline code
   */
  isTranslatableContent(text: string): boolean {
    const stripped = text.replace(/\s/g, '')
    if (stripped.length < 3) return false
    if (this.isOnlyEmoji(stripped)) return false
    if (this.isSpamContent(text)) return false

    // Remove fenced code blocks (```...```) and inline code (`...`), then check what remains
    const withoutCode = text
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`[^`\n]+`/g, '')
      .trim()

    if (withoutCode.length === 0) return false

    return /\p{L}/u.test(withoutCode)
  }

  /**
   * Returns true when the message is spam, a test, or has no real translatable meaning.
   * Detects:
   * - Exact test/noise phrases (en/vi/ja)
   * - Single character repeated ≥ 4 times ("aaaa", "....", "!!!!")
   * - Repeating 2–4 char pattern ≥ 3 cycles ("hahaha", "hehehe", "lololo", "xoxo")
   * - Single unique word repeated ≥ 4 times ("ok ok ok ok ok", "ha ha ha ha")
   */
  private isSpamContent(text: string): boolean {
    const lower = text.trim().toLowerCase()

    // Exact-match phrases that are clearly test/noise (full message only)
    const EXACT_SPAM = new Set([
      // Test keywords
      'test',
      'testing',
      'test.',
      'test..',
      'test...',
      '1 2 3',
      '1, 2, 3',
      'hello world',
      'ping',
      'pong',
      // Common keyboard mash
      'abc',
      'xyz',
      'asdf',
      'qwerty',
      // Internet slang with no translation value
      'lol',
      'lmao',
      'omg',
      'wtf',
      'brb',
      'afk',
      'kkk',
      'zzz',
      // Vietnamese test phrases
      'thử',
      'thử nghiệm',
      'thử thôi',
      'thử xem',
      // Japanese test phrases
      'テスト',
      '試し',
    ])

    if (EXACT_SPAM.has(lower)) return true

    const noSpaces = lower.replace(/\s+/g, '')
    if (noSpaces.length < 3) return false

    // Single character repeated ≥ 4 times: "aaaa", "....", "!!!!!"
    if (/^(.)\1{3,}$/.test(noSpaces)) return true

    // Repeating 2–4 character pattern ≥ 3 full cycles: "hahaha", "hehehe", "xoxoxo", "lololo"
    if (/^(.{2,4})\1{2,}$/.test(noSpaces)) return true

    // Single unique word repeated ≥ 4 times: "ok ok ok ok", "ha ha ha ha"
    const words = lower.trim().split(/\s+/)
    if (words.length >= 4 && new Set(words).size === 1) return true

    return false
  }

  private isOnlyEmoji(text: string): boolean {
    const stripped = text.replace(/\s/g, '')
    if (stripped.length === 0) return true
    const emojiRegex = /^[\p{Emoji_Presentation}\p{Extended_Pictographic}]+$/u

    return emojiRegex.test(stripped)
  }
}
