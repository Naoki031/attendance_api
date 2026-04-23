import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import Anthropic from '@anthropic-ai/sdk'
import moment from 'moment'
import type { ChatMessageItemDto } from './dto/chat-message.dto'
import { PromptBuilderService } from './prompt-builder/prompt-builder.service'
import { ChatbotCacheService } from './cache/chatbot-cache.service'
import { ChatbotLogService } from './cache/chatbot-log.service'
import { ErrorLogsService } from '@/modules/error_logs/error_logs.service'

@Injectable()
export class ChatbotService {
  private readonly logger = new Logger(ChatbotService.name)
  private client: Anthropic | null = null
  private model: string = 'claude-sonnet-4-6'

  constructor(
    private readonly configService: ConfigService,
    private readonly promptBuilder: PromptBuilderService,
    private readonly cacheService: ChatbotCacheService,
    private readonly logService: ChatbotLogService,
    private readonly errorLogsService: ErrorLogsService,
  ) {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY')

    if (!apiKey) {
      this.logger.warn('Chatbot disabled: ANTHROPIC_API_KEY is not set')

      return
    }

    this.model = this.configService.get<string>('CHATBOT_MODEL') ?? 'claude-sonnet-4-6'
    this.client = new Anthropic({ apiKey })
  }

  isReady(): boolean {
    return this.client !== null
  }

  /**
   * Parses the raw Claude response text, extracts the <suggestions> block,
   * and returns the clean reply text alongside the suggestion list.
   */
  private parseResponse(rawText: string): { reply: string; suggestions: string[] } {
    const match = rawText.match(/<suggestions>([\s\S]*?)<\/suggestions>/)
    if (!match) return { reply: rawText.trim(), suggestions: [] }

    const reply = rawText.replace(/<suggestions>[\s\S]*?<\/suggestions>/, '').trim()
    const suggestions = match[1]
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 3)

    return { reply, suggestions }
  }

  /**
   * Sends a conversation to Claude and returns the assistant reply with follow-up suggestions.
   * Uses semantic cache to avoid redundant API calls for similar questions.
   * Rejects spam and off-topic input before calling the API.
   */
  async chat(
    messages: ChatMessageItemDto[],
    tone?: string,
    language?: string,
    isAdmin = false,
  ): Promise<{ reply: string; suggestions: string[]; fromCache: boolean }> {
    if (!this.client) {
      return {
        reply: 'Chatbot is not configured. Please set ANTHROPIC_API_KEY.',
        suggestions: [],
        fromCache: false,
      }
    }

    const role = isAdmin ? 'admin' : 'employee'
    const resolvedTone = tone ?? 'professional'
    const lastUserMessage = [...messages].reverse().find((message) => message.role === 'user')
    const startTime = moment().valueOf()

    // Guard: reject spam and off-topic input before any API call
    if (lastUserMessage) {
      const userContent = lastUserMessage.content

      if (this.isSpamInput(userContent)) {
        this.logService
          .log({
            role,
            tone: resolvedTone,
            language,
            status: 'rejected',
            errorMessage: 'spam',
          })
          .catch(() => {})

        return {
          ...this.getLocalizedReplies('spam', language),
          fromCache: false,
        }
      }

      if (this.isOffTopicInput(userContent)) {
        this.logService
          .log({
            role,
            tone: resolvedTone,
            language,
            status: 'rejected',
            errorMessage: 'off-topic',
          })
          .catch(() => {})

        return {
          ...this.getLocalizedReplies('off-topic', language),
          fromCache: false,
        }
      }
    }

    // Cache lookup — only for short conversations where the question is likely standalone
    if (lastUserMessage && this.cacheService.shouldCache(messages.length)) {
      const cacheStart = moment().valueOf()
      const cached = await this.cacheService.lookup(lastUserMessage.content, role, resolvedTone)
      const cacheLookupMs = moment().valueOf() - cacheStart

      if (cached) {
        // Fire-and-forget log
        this.logService
          .log({
            role,
            tone: resolvedTone,
            language,
            status: 'cache_hit',
            cacheLookupMs,
          })
          .catch(() => {})

        return { ...cached, fromCache: true }
      }
    }

    try {
      const apiStart = moment().valueOf()
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1024,
        system: this.promptBuilder.buildSystemPrompt({ tone, language, isAdmin }),
        messages: messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
      })
      const apiCallMs = moment().valueOf() - apiStart

      const block = response.content[0]
      const rawText = block.type === 'text' ? block.text : ''
      const parsed = this.parseResponse(rawText)

      // Fire-and-forget: save to cache + log
      const logPromise = this.logService.log({
        role,
        tone: resolvedTone,
        language,
        status: 'cache_miss',
        inputTokens: response.usage?.input_tokens,
        outputTokens: response.usage?.output_tokens,
        apiCallMs,
        modelUsed: this.model,
      })

      if (lastUserMessage && this.cacheService.shouldCache(messages.length)) {
        const sectionIds = this.promptBuilder.getSectionIdsForRole(role)
        Promise.all([
          this.cacheService.save(
            lastUserMessage.content,
            parsed.reply,
            parsed.suggestions,
            role,
            resolvedTone,
            language,
            sectionIds,
            this.model,
          ),
          logPromise,
        ]).catch(() => {})
      } else {
        logPromise.catch(() => {})
      }

      return { ...parsed, fromCache: false }
    } catch (error) {
      this.logger.error('Failed to get chatbot response', error)
      this.errorLogsService.logError({
        message: 'Failed to get chatbot response',
        stackTrace: (error as Error).stack ?? null,
        path: 'chatbot',
      })

      // Fire-and-forget error log
      this.logService
        .log({
          role,
          tone: resolvedTone,
          language,
          status: 'error',
          apiCallMs: moment().valueOf() - startTime,
          errorMessage: (error as Error).message,
        })
        .catch(() => {})

      throw error
    }
  }

  /**
   * Detects language of text via character analysis (no API call).
   */
  private detectLocalLanguage(text: string): string {
    const hasVietnamese = /[đĐăĂâÂêÊôÔơƠưƯ]/.test(text)
    if (hasVietnamese) return 'vi'
    const hasJapanese = /[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(text)
    if (hasJapanese) return 'ja'

    return 'en'
  }

  private pickRandom(candidates: string[]): string {
    return candidates[Math.floor(Math.random() * candidates.length)]
  }

  private normalizeLanguage(language?: string): string {
    if (!language) return 'vi'
    const lower = language.toLowerCase()
    if (lower.includes('vi')) return 'vi'
    if (lower.includes('ja') || lower.includes('jp')) return 'ja'
    return 'en'
  }

  private getLocalizedReplies(
    type: 'off-topic' | 'spam',
    language?: string,
  ): { reply: string; suggestions: string[] } {
    const lang = this.normalizeLanguage(language)
    const isVi = lang === 'vi'
    const isJa = lang === 'ja'

    if (type === 'spam') {
      if (isJa) {
        return {
          reply: this.pickRandom([
            'もう少し分かりやすく入力していただけますか？勤怠システムについてお手伝いします！',
            '質問をはっきりと入力してください。勤怠システムについてサポートいたします！',
          ]),
          suggestions: ['出勤打刻の方法', '休暇申請の方法'],
        }
      }

      if (!isVi) {
        return {
          reply: this.pickRandom([
            "Could you rephrase that? I didn't catch a clear question about the system.",
            "Please type a proper question and I'll be happy to help with the attendance system!",
          ]),
          suggestions: ['How to clock in?', 'How to request leave?'],
        }
      }

      return {
        reply: this.pickRandom([
          'Bạn nhập lại câu hỏi rõ hơn được không? Mình sẽ hỗ trợ bạn về hệ thống chấm công!',
          'Hãy gõ câu hỏi rõ ràng hơn nhé — mình sẵn sàng hỗ trợ về hệ thống chấm công!',
        ]),
        suggestions: ['Cách chấm công?', 'Cách xin nghỉ phép?'],
      }
    }

    // off-topic
    if (isJa) {
      return {
        reply: this.pickRandom([
          '勤怠管理システムに関するご質問のみ対応しております。出勤打刻、休暇申請などについてお気軽にどうぞ！',
          'こちらは勤怠管理システム専用のアシスタントです。打刻、申請などについてご質問ください。',
        ]),
        suggestions: ['出勤打刻の方法', '休暇申請の方法'],
      }
    }

    if (!isVi) {
      return {
        reply: this.pickRandom([
          'I can only help with the Attendance Management System. Feel free to ask about clock-in/out, leave, overtime, WFH, or other features!',
          "That's outside my scope — I'm here to help with the Attendance Management System only.",
        ]),
        suggestions: ['How to clock in?', 'How to request leave?', 'WFH features'],
      }
    }

    return {
      reply: this.pickRandom([
        'Mình chỉ hỗ trợ các câu hỏi liên quan đến hệ thống chấm công thôi nhé. Hãy hỏi về chấm công, nghỉ phép, WFH hoặc các tính năng khác!',
        'Câu hỏi này ngoài phạm vi hệ thống rồi. Mình có thể giúp về chấm công, tạo yêu cầu, WFH — cứ hỏi nhé!',
      ]),
      suggestions: ['Cách chấm công?', 'Cách xin nghỉ phép?', 'Tính năng WFH?'],
    }
  }

  /**
   * Returns true when the last user message is clearly spam / meaningless
   * (random chars, keyboard mash, emoji-only, repetitive text).
   */
  private isSpamInput(text: string): boolean {
    const stripped = text.replace(/\s/g, '')

    // Too short to be meaningful
    if (stripped.length < 2) return true

    // Emoji / symbol only
    const emojiSymbolRegex =
      /^[\p{Emoji_Presentation}\p{Extended_Pictographic}\p{Punctuation}\p{Symbol}]+$/u
    if (emojiSymbolRegex.test(stripped)) return true

    // Single character repeated 4+ times
    if (/^(.)\1{3,}$/.test(stripped)) return true

    // Repeating 2-4 char pattern 3+ cycles
    if (/^(.{2,4})\1{2,}$/.test(stripped)) return true

    // Single word repeated 4+ times
    const words = text.trim().toLowerCase().split(/\s+/)
    if (words.length >= 4 && new Set(words).size === 1) return true

    // Very few unique characters relative to length (keyboard mash)
    const uniqueChars = new Set(stripped.toLowerCase()).size
    if (stripped.length > 8 && uniqueChars / stripped.length < 0.25) return true

    // Random-looking: alternating consonants/digits with no vowels and no CJK
    const noSpaces = stripped.toLowerCase()
    const vowelRegex = /[aeiouyàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹ]/u
    const hasVowels = vowelRegex.test(noSpaces)
    const hasCJK = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(noSpaces)
    if (!hasVowels && !hasCJK && noSpaces.length > 6) return true

    return false
  }

  /**
   * Returns true when the message is likely NOT related to the attendance system.
   * Uses keyword matching + question-pattern detection as a fast pre-filter.
   */
  private isOffTopicInput(text: string): boolean {
    const lower = text.trim().toLowerCase()

    // Pure greetings — allow through, AI will introduce itself
    const pureGreetings =
      /^(hi|hello|hey|chào|xin chào|こんにちは|おはよう|こんばんは|yo|sup|good (morning|afternoon|evening))\s*[!!.。]*$/i
    if (pureGreetings.test(lower)) return false

    const systemKeywords = [
      // English
      'attendance',
      'clock',
      'check-in',
      'check-out',
      'clock-in',
      'clock-out',
      'check in',
      'check out',
      'leave',
      'day off',
      'overtime',
      'wfh',
      'work from home',
      'remote',
      'request',
      'form',
      'approve',
      'reject',
      'approval',
      'submit',
      'salary',
      'payroll',
      'payslip',
      'business trip',
      'equipment',
      'profile',
      'password',
      'login',
      'logout',
      'setting',
      'avatar',
      'notification',
      'language',
      'translate',
      'dark mode',
      'theme',
      'chat',
      'message',
      'meeting',
      'video call',
      'room',
      'report',
      'export',
      'csv',
      'excel',
      'pdf',
      'calendar',
      'schedule',
      'shift',
      'holiday',
      'admin',
      'manager',
      'employee',
      'user',
      'role',
      'permission',
      'department',
      'company',
      'branch',
      'face',
      'kyc',
      'fingerprint',
      'memo',
      'announcement',
      'memory',
      'album',
      'photo',
      'system',
      'feature',
      'function',
      'how to',
      'how do',
      'where is',
      'where can',
      'can i',
      'is there',
      'does the',
      'what is',
      'what are',
      'help',
      'support',
      'guide',
      'tutorial',
      // Vietnamese
      'chấm công',
      'điểm danh',
      'vân tay',
      'khuôn mặt',
      'nhận diện',
      'nghỉ phép',
      'làm thêm',
      'tăng ca',
      'làm nhà',
      'yêu cầu',
      'duyệt',
      'từ chối',
      'phê duyệt',
      'gửi yêu cầu',
      'lương',
      'bảng lương',
      'phiếu lương',
      'công tác',
      'hồ sơ',
      'mật khẩu',
      'đăng nhập',
      'cài đặt',
      'thông báo',
      'dịch',
      'giao diện',
      'tin nhắn',
      'cuộc gọi',
      'phòng họp',
      'báo cáo',
      'xuất',
      'tải về',
      'lịch',
      'ca làm',
      'ngày nghỉ',
      'lễ',
      'quản lý',
      'nhân viên',
      'vai trò',
      'quyền',
      'phòng ban',
      'công ty',
      'chi nhánh',
      'sổ tay',
      'kỷ niệm',
      'ảnh',
      'tính năng',
      'hướng dẫn',
      'hỗ trợ',
      // Japanese
      '勤怠',
      '打刻',
      '出勤',
      '退勤',
      '指紋',
      '顔認証',
      '休暇',
      '残業',
      'テレワーク',
      '在宅',
      '申請',
      '承認',
      '却下',
      '提出',
      '給与',
      '明細',
      '出張',
      'プロフィール',
      'パスワード',
      'ログイン',
      '設定',
      '通知',
      '翻訳',
      'テーマ',
      'チャット',
      'メッセージ',
      '会議',
      'ビデオ通話',
      'レポート',
      'エクスポート',
      'カレンダー',
      'シフト',
      '祝日',
      '管理者',
      '従業員',
      '権限',
      '部署',
      '会社',
      '支社',
      '機能',
      '使い方',
      'ヘルプ',
    ]

    for (const keyword of systemKeywords) {
      if (lower.includes(keyword)) return false
    }

    // Question patterns — likely a real question, let it through for AI to judge
    const questionPatterns = [
      /\?|？/,
      /^(how|what|where|when|why|who|which|can|do|is|are|will|would|should|could)\b/i,
      /^(làm sao|thế nào|ở đâu|khi nào|tại sao|ai|cái gì|như thế nào|có thể|có không)\b/i,
      /^(どう|どこ|いつ|なぜ|誰|どれ|どうやって|できますか|ありますか|教えて)\b/i,
    ]

    for (const pattern of questionPatterns) {
      if (pattern.test(lower)) return false
    }

    return true
  }
}
