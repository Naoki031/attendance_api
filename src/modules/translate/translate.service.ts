import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import Anthropic from '@anthropic-ai/sdk'
import moment from 'moment'
import { TranslationCache } from './entities/translation_cache.entity'
import { TranslationLogService } from './translation-log.service'
import { ErrorLogsService } from '@/modules/error_logs/error_logs.service'

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
 * Post-processing for Vietnamese translation output.
 * Handles transformations that are safer to do in code than rely on prompt alone.
 */
function applyVietnameseStyleRules(text: string): string {
  const result = text
    // Strip leftover Japanese name suffixes (prompt says omit, but LLM sometimes ignores)
    .replace(/[ぁ-んァ-ヶ]さん/g, '')
    .replace(/[ぁ-んァ-ヶ]くん/g, '')
    .replace(/[ぁ-んァ-ヶ]ちゃん/g, '')
    // Replace stiff "tôi" at sentence start with "mình"
    .replace(/(?:^|[.!?。！？]\s*)Tôi /gm, '$1Mình ')
    .replace(/(?:^|[.!?。！？]\s*)tôi /gm, '$1mình ')
    // Replace overly formal phrase
    .replace(/\bxin vui lòng\b/gi, 'nhé')

  return result.replace(/\s{2,}/g, ' ').trim()
}

// Core rules — always included. Compact for no-cache mode (~1,200 tokens).
const CORE_TRANSLATION_RULES = [
  `Translate naturally — output must read as if a native speaker wrote it from scratch. Restructure sentences freely. Match source formality: casual stays warm/friendly, never stiff.`,
  ``,
  `MIXED-LANGUAGE RULES (CRITICAL):`,
  `Workplace messages often mix languages in one sentence. Example: Vietnamese with Japanese embedded, or vice versa.`,
  `- Treat the ENTIRE message as one unified thought — translate ALL parts into the target language, including embedded foreign segments.`,
  `- NEVER leave a portion untranslated just because it was already in the target language.`,
  `  BAD: source="Bug này fix rồi、確認お願いします" → JA="Bug này fix ようにしたよ、確認お願いします" (Vietnamese left as-is)`,
  `  GOOD: source="Bug này fix rồi、確認お願いします" → JA="このバグは修正したよ、確認してね"`,
  `  GOOD: source="Bug này fix rồi、確認お願いします" → EN="The bug is fixed now, please check it"`,
  `  GOOD: source="確認ありがとうございます、mình nhận được rồi" → JA="確認ありがとうございます、受け取りました"`,
  ``,
  `VI RULES:`,
  `- Use bạn/mình, NOT tôi (stiff/distant). Particles: nhé nha ha nè for warmth. Connectors: thì mà nên nhưng vì nếu.`,
  `- Natural phrases (NOT the stiff alternatives):`,
  `  "mình hiểu rồi" (not "tôi đã hiểu") | "để mình xem lại nhé" (not "để tôi kiểm tra")`,
  `  "cảm ơn bạn nhé" (not "cảm ơn bạn") | "ok mình xử lý nha" (not "tôi sẽ xử lý")`,
  `  "bạn ơi" for attention — never drop it | "hẹn gặp lại nhé" (not "hẹn gặp lại")`,
  `- Avoid in casual chat: tôi → mình/bạn. "xin vui lòng" → nhé/nha. "chúng ta" → mình. "do đó/vì vậy" → nên/thế nên. "tôi đồng ý" → mình đồng ý nha/đúng rồi. "bạn có thể...không?" → "...được không?"/"...nha".`,
  `- "bạn" = both "you" and "friend" — use context. Warmth from particles, not pronoun changes. Never translate さん/くん/ちゃん into Vietnamese — omit.`,
  ``,
  `JA↔VI RULES:`,
  `- JA→VI: add subject (bạn/mình/anh/chị) where Japanese omits. ね→nhỉ/nhé. よ→đấy/nhé. 〜ましょう/ましょうか→"mình...nhé"/"...không?". 〜てください→"bạn...nhé"/"giúp mình...nha".`,
  `- VI→JA: omit subject entirely (NEVER あなた/君). nhé/nha→ね/よ/よね. "cảm ơn"→ありがとうございます(formal)/ありがとう(casual). "xin lỗi"→すみません/ごめん. "đã...rồi"→〜た. "sẽ"→〜つもり/〜予定. "dạ"→soft はい. anh/chị/em→omit or name, never kinship. "được không?"→〜てもいい？. "phải không?"→〜ですか？. "bạn ăn cơm chưa"→casual 〜た？.`,
  ``,
  `JA STRICT RULES:`,
  `- NEVER あなた or 君 — render "you" by omitting subject: このテーブルのことですか？ (not あなたはこのテーブルのことを言っていますか？)`,
  `- NEVER 僙/俺. NEVER kinship terms (姉さん/お兄さん) for workplace.`,
  `- Casual source→casual output: 非常に難しい→かなり難しい. 言及していますか→そのことですか？. その通り→そうですよ.`,
  `- Merge clauses with て/から/し. Soft tone: 〜くださいね/〜といいですね/〜ほしいです.`,
  `- Replace: 大切にしてください→お体に気をつけて. 支援が必要/助けが必要→困ったことがあれば. 疲れているように見える→なんか疲れてそう. 早く元気になってほしい→早く良くなるといいね. すごく心配している→大丈夫？気になってたんだけど.`,
  `- Caring: add 気軽に/といいですね/どうか naturally. NEVER もらいたいです for health wishes. NEVER ぜひ with negative requests. Do not overuse.`,
  ``,
  `BAD: あなたもお体に気をつけてください | 疲れているように見えるよ。ゆっくり休んでね。(literal+segmented) | 早く元気になってもらいたいです。(speaker-centric) | "Tôi cảm ơn bạn." | "Tôi đã hiểu." | "Xin lỗi vì sự bất tiện."`,
  `GOOD: ちょっとお疲れみたいだし、無理せずゆっくり休んでね。 | 困ったことがあれば気軽に声をかけてね。早く良くなるといいね🙏 | "Mình đang bận một chút, xong mình phản hồi bạn sau nhé." | "Bạn ơi, cái này mình chưa rõ, giải thích thêm được không?" | "Cảm ơn bạn nhiều nha, nhờ vậy mà xong sớm."`,
  `JA→VI: 今日は寒いね→"Hôm nay lạnh nhỉ." | 会議は3時からだよ→"Họp lúc 3 giờ đó."`,
  `VI→JA: Mình hơi mệt hôm nay→"今日ちょっと疲れてて..." | Bạn gửi mình file đó nhé→"そのファイル送ってくれる？"`,
  ``,
  `FIXED: よろしくお願いします="Thanks in advance". かしこまりました="Certainly". お疲れ様です="Good work". vâng=polite yes. dạ=soft yes. không sao đâu=no worries. không có gì=you're welcome.`,
  `PRESERVE: ${IT_TERMS_PRESERVED}; ${ATTENDANCE_TERMS_PRESERVED}.`,
  `FORMAT: Profanity→[***]. Keep ALL emojis (Unicode + :custom-codes:). Keep @mentions/links/code. No proper nouns/URLs/ticket IDs. No adding/removing content.`,
  `SELF-CHECK before output: 1) Read your translation aloud — does it sound like something a real person would say in a workplace chat? If it feels robotic or textbook-like, rewrite. 2) Are short choppy clauses merged into one flowing sentence? 3) No あなた/君? No tôi in VI? 4) Was any embedded foreign text left untranslated? If fail→rewrite.`,
].join('\n')

// Extra examples — only included when cache is enabled to pad prompt above Haiku's 2048-token threshold.
// These examples improve translation quality AND enable prompt caching cost savings (~87%).
const CACHE_PADDING_EXAMPLES = [
  ``,
  `WORKPLACE EXAMPLES (use these as reference for tone and naturalness):`,
  `VI→JA:`,
  `  "Hôm nay WFH nhé" → "今日はWFHだよ"`,
  `  "PR này bạn review giúp mình nha" → "このPRレビューお願いできる？"`,
  `  "Deploy xong rồi、確認してね" → "デプロイ完了したよ、確認してね"`,
  `  "Mình nghỉ phép tuần sau" → "来週お休みいただきます"`,
  `  "Bug production đã fix rồi nhé" → "本番のバグは修正したよ"`,
  `  "Bạn ơi, meeting 3 giờ chuyển sang 4 giờ được không?" → "ミーティング3時から4時に変更してもいい？"`,
  `JA→VI:`,
  `  "お疲れ様です、確認しました" → "Cảm ơn bạn nhé, mình kiểm tra rồi"`,
  `  "明日リモートでお願いします" → "Mình làm remote mai nhé"`,
  `  "レビューお願いできますか？" → "Bạn review giúp mình được không?"`,
  `  "修正しました、再度確認お願いします" → "Mình sửa xong rồi, bạn check lại giúp mình nha"`,
  `  "会議は3時に変更になりました" → "Họp dời sang 3 giờ rồi nhé"`,
  `  "お疲れ様でした！" → "Làm tốt lắm nhé!" / "Cảm ơn bạn nha!"`,
  `  "少し体調が悪いので今日はお休みします" → "Hôm nay mình hơi mệt nên nghỉ nhé"`,
  `  "この件について教えていただけますか？" → "Chuyện này bạn giải thích thêm cho mình được không?"`,
  `  "月曜日の会議に出られません" → "Thứ hai mình không họp được nhé"`,
  `JA→EN:`,
  `  "お疲れ様です、確認しました" → "Thanks, I've checked it"`,
  `  "明日リモートでお願いします" → "I'll be working remote tomorrow"`,
  `  "レビューお願いできますか？" → "Could you review this?"`,
  `  "デプロイ完了しました" → "Deploy is done"`,
  `  "少し体調が悪いので今日はお休みします" → "Not feeling well today, taking a day off"`,
  `  "このバグは本番環境で発生しています" → "This bug is happening in production"`,
  `  "ステージング環境でテストお願いします" → "Please test on staging"`,
  `VI→EN:`,
  `  "Mình gửi mail rồi nhé" → "Just sent the email"`,
  `  "Bạn check giúp mình cái này" → "Can you check this for me?"`,
  `  "Hôm nay mình WFH" → "I'm working from home today"`,
  `  "Bug này khó quá, bạn xem giúp nha" → "This bug is tricky, can you take a look?"`,
  `  "Xong rồi nhé" → "All done!"`,
  `  "Mình đi ăn trưa nhé" → "Heading to lunch, brb"`,
  `EN→VI:`,
  `  "Can you review my PR?" → "Bạn review PR giúp mình nha"`,
  `  "The deploy failed" → "Deploy lỗi rồi bạn ơi"`,
  `  "Let me check and get back to you" → "Để mình kiểm tra rồi phản hồi bạn sau nhé"`,
  `  "I'll be off tomorrow" → "Mình nghỉ mai nhé"`,
  `  "Nice work!" → "Làm tốt lắm nha!"`,
  `EN→JA:`,
  `  "Can you review my PR?" → "PRレビューお願いできる？"`,
  `  "The deploy failed" → "デプロイ失敗したよ"`,
  `  "Let me check and get back to you" → "確認してからまた連絡するね"`,
  `  "I'll be off tomorrow" → "明日お休みいただきます"`,
  `  "Nice work!" → "お疲れ様！"`,
  `  "Running late, be there in 10" → "ちょっと遅れてる、10分後に行くね"`,
  ``,
  `IT TERMINOLOGY (preserve these as-is in all languages, do NOT translate to local equivalents):`,
  `API endpoint, PR (pull request), commit, merge, branch, staging, production, database, server, cache, debug, Docker, CI/CD, dashboard, WFH, overtime.`,
  `When translating around these terms, keep them embedded naturally:`,
  `  "PR này merge chưa?" → "Did you merge this PR?" / "このPRマージした？"`,
  `  "Server down rồi" → "サーバー落ちたよ" / "Server is down"`,
  `  "Cache cleared rồi nhé" → "キャッシュクリアしたよ" / "Cache is cleared"`,
  `  "Staging OK rồi、本番deployしよう" → "Staging looks good, let's deploy to production"`,
  `  "Bug này repro được ở staging" → "This bug is reproducible on staging" / "このバグはstagingで再現できるよ"`,
  `VI IT slang → keep context: "lỗi" can mean bug/error/crash. "test thử" = try testing. "xong rồi" = done. "deploy cái này" = deploy this. "fix bug" = fix the bug. "check log" = check the logs. "restart lại" = restart it.`,
  `JA IT context: "本番" = production. "検証環境" = staging. "マージ" = merge. "リリース" = release. "障害" = incident/outage.`,
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
  intent?: MessageIntent,
): Array<{ type: 'text'; text: string; cache_control?: { type: 'ephemeral'; ttl?: '5m' | '1h' } }> {
  const dynamicLines = [
    `Workplace chat translator. Translate from ${sourceLang} to ${targetDescription}.`,
    intent && intent !== 'neutral' ? `Message intent: ${intent}. Adjust warmth accordingly.` : '',
    glossarySection,
    `- Return format: ${outputInstruction}`,
  ]
    .filter(Boolean)
    .join('\n')

  // When cache enabled: use core + padding to exceed Haiku's 2048-token cache threshold.
  // When cache disabled: use core only — compact prompt saves tokens.
  const staticText = cachePrompt
    ? CORE_TRANSLATION_RULES + CACHE_PADDING_EXAMPLES
    : CORE_TRANSLATION_RULES

  // Two-tier caching: 1h on static rules (never change), 5m on dynamic block (per-request).
  // Anthropic requires longer TTL blocks before shorter ones.
  // This keeps the static prefix cached for long conversations while dynamic context refreshes naturally.
  return [
    {
      type: 'text',
      text: staticText,
      ...(cachePrompt ? { cache_control: { type: 'ephemeral', ttl: '1h' as const } } : {}),
    },
    {
      type: 'text',
      text: dynamicLines,
      ...(cachePrompt ? { cache_control: { type: 'ephemeral' } } : {}),
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
    private readonly errorLogsService: ErrorLogsService,
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

  /**
   * Fast local language detection using character pattern matching.
   * Covers the three supported languages (vi, en, ja) with high confidence.
   * Returns null when the text is ambiguous and AI detection is needed.
   */
  detectLanguageLocally(text: string): string | null {
    const sample = text.slice(0, 500)

    // Japanese: presence of hiragana or katakana is unambiguous
    if (/[\u3040-\u309F\u30A0-\u30FF]/.test(sample)) return 'ja'

    // Vietnamese: characters unique to Vietnamese orthography
    if (/[đĐ]|[àáâãèéêìíòóôõùúýăắặổọụ]/i.test(sample) && /[ắặổộụ]/i.test(sample)) return 'vi'

    // Pure ASCII (letters, numbers, common punctuation) → English
    if (/^[\x20-\x7E\n\r\t]+$/.test(sample) && /[a-zA-Z]/.test(sample)) return 'en'

    return null
  }

  async detectLanguage(text: string): Promise<string> {
    // Try fast local detection first — avoids an AI API call for obvious cases
    const localResult = this.detectLanguageLocally(text)
    if (localResult) return localResult

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
      this.errorLogsService.logError({
        message: 'Failed to detect language',
        stackTrace: (error as Error).stack ?? null,
        path: 'translate',
      })

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

    const intent = detectIntent(text)
    const systemBlocks = buildTranslationSystemBlocks(
      sourceLang,
      `ALL of: ${targetLangs.join(', ')}`,
      `Return JSON {"lang":"translation",...}. ONLY JSON, no markdown, no explanation.`,
      glossarySection,
      this.cachePrompt,
      intent,
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

    const intent = detectIntent(text)
    const systemBlocks = buildTranslationSystemBlocks(
      sourceLang,
      targetLang,
      `Return ONLY the translated text, no explanation, no markdown wrapper, no quotes.`,
      glossarySection,
      this.cachePrompt,
      intent,
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
      this.errorLogsService.logError({
        message: `Failed to save translation cache for messageId=${messageId}`,
        stackTrace: (error as Error).stack ?? null,
        path: 'translate',
      })
    }

    return this.pickTranslations(merged, targetLangs)
  }

  async invalidateCache(messageId: number): Promise<void> {
    try {
      await this.translationCacheRepository.delete({ messageId })
    } catch (error) {
      this.logger.error('Failed to invalidate translation cache', error)
      this.errorLogsService.logError({
        message: `Failed to invalidate translation cache for messageId=${messageId}`,
        stackTrace: (error as Error).stack ?? null,
        path: 'translate',
      })
    }
  }

  private async findCache(messageId: number): Promise<TranslationCache | null> {
    try {
      return await this.translationCacheRepository.findOneBy({ messageId })
    } catch (error) {
      this.logger.error('Failed to query translation cache', error)
      this.errorLogsService.logError({
        message: `Failed to query translation cache for messageId=${messageId}`,
        stackTrace: (error as Error).stack ?? null,
        path: 'translate',
      })

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
    systemBlocks: Array<{
      type: 'text'
      text: string
      cache_control?: { type: 'ephemeral'; ttl?: '5m' | '1h' }
    }>,
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
    const isVietnameseTarget = targetLang.includes('vi')
    const intent = isJapaneseTarget || isVietnameseTarget ? detectIntent(text) : 'neutral'

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

          if (streamResult && isJapaneseTarget) {
            return applyJapaneseStyleRules(streamResult, intent)
          }
          if (streamResult && isVietnameseTarget) {
            return applyVietnameseStyleRules(streamResult)
          }
          return streamResult
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

          if (rawResult && isJapaneseTarget) {
            return applyJapaneseStyleRules(rawResult, intent)
          }
          if (rawResult && isVietnameseTarget) {
            return applyVietnameseStyleRules(rawResult)
          }
          return rawResult
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
        this.errorLogsService.logError({
          message: `Translation failed — target=${targetLang} attempt=${attempt}: ${(error as Error).message}`,
          stackTrace: (error as Error).stack ?? null,
          path: 'translate',
        })

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
   * - Keyboard mash / random gibberish (low unique-char ratio)
   * - No-vowel no-CJK noise (random consonant/digit strings)
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

    // Keyboard mash / gibberish: very few unique characters relative to total length
    const uniqueChars = new Set(noSpaces).size
    if (noSpaces.length > 10 && uniqueChars / noSpaces.length < 0.25) return true

    // Random consonant/digit strings with no vowels and no CJK characters
    const vowelRegex = /[aeiouyàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹ]/u
    const hasVowels = vowelRegex.test(noSpaces)
    const hasCJK = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(noSpaces)
    if (!hasVowels && !hasCJK && noSpaces.length > 8) return true

    return false
  }

  private isOnlyEmoji(text: string): boolean {
    // Strip custom emoji tokens like :blob-happy: before checking
    const withoutCustom = text.replace(/:[a-z0-9_-]+:/g, '')
    const stripped = withoutCustom.replace(/\s/g, '')
    if (stripped.length === 0) return true
    const emojiRegex = /^[\p{Emoji_Presentation}\p{Extended_Pictographic}]+$/u

    return emojiRegex.test(stripped)
  }
}
