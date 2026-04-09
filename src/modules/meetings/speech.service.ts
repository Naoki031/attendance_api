import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { TranslateService } from '@/modules/translate/translate.service'
import { TtsService } from './tts.service'

export interface SpeechResult {
  original: string
  language: string
  translations: Record<string, string>
  audioBase64: Record<string, string | null>
}

@Injectable()
export class SpeechService {
  private readonly logger = new Logger(SpeechService.name)
  private readonly whisperUrl: string
  private readonly groqApiKey: string | null = null
  private readonly sttEnabled: boolean

  constructor(
    private readonly configService: ConfigService,
    private readonly translateService: TranslateService,
    private readonly ttsService: TtsService,
  ) {
    this.whisperUrl = this.configService.get<string>('WHISPER_URL') ?? 'http://whisper:5001'
    this.groqApiKey = this.configService.get<string>('GROQ_API_KEY') ?? null
    this.sttEnabled = this.configService.get<string>('STT_ENABLED') !== 'false'

    if (!this.sttEnabled) {
      this.logger.warn('STT_ENABLED=false — speech-to-text transcription is disabled')
    } else if (this.groqApiKey) {
      this.logger.log('Groq transcription enabled (primary) — local Whisper as fallback')
    } else {
      this.logger.log('Using local Whisper for transcription (no GROQ_API_KEY set)')
    }
  }

  async transcribeOnly(
    audioBuffer: Buffer,
    languageHint?: string,
    isScreenAudio = false,
  ): Promise<{ text: string; language: string }> {
    if (!this.sttEnabled) {
      return { text: '', language: languageHint ?? 'en' }
    }

    // Groq: fast cloud transcription (~150-300ms) — skip ffmpeg, sends WebM directly
    if (this.groqApiKey) {
      try {
        return await this.transcribeWithGroq(audioBuffer, languageHint)
      } catch (error) {
        this.logger.warn(`Groq failed (${(error as Error).message}), falling back to local Whisper`)
      }
    }

    // Fallback: local Whisper (1.5-3s on CPU)
    return this.transcribeWithLocalWhisper(audioBuffer, languageHint, isScreenAudio)
  }

  async translateAndSynthesize(
    text: string,
    language: string,
    targetLanguages: string[],
    ttsEnabled = false,
  ): Promise<{ translations: Record<string, string>; audioBase64: Record<string, string | null> }> {
    const translationTargets = targetLanguages.filter((lang) => lang !== language)
    const translations = await this.translateService.translateToMultiple(
      text,
      language,
      translationTargets,
    )

    const audioBase64: Record<string, string | null> = {}

    if (ttsEnabled) {
      await Promise.all(
        translationTargets.map(async (lang) => {
          const translatedText = translations[lang]
          if (translatedText) {
            audioBase64[lang] = await this.ttsService.synthesize(translatedText, lang)
          }
        }),
      )
    }

    return { translations, audioBase64 }
  }

  async process(
    audioBuffer: Buffer,
    _meetingId: number,
    _speakerId: number,
    targetLanguages: string[],
    languageHint?: string,
    ttsEnabled = false,
    isScreenAudio = false,
  ): Promise<SpeechResult> {
    const { text, language } = await this.transcribeOnly(audioBuffer, languageHint, isScreenAudio)

    if (!text) {
      return { original: '', language: language ?? 'en', translations: {}, audioBase64: {} }
    }

    const { translations, audioBase64 } = await this.translateAndSynthesize(
      text,
      language,
      targetLanguages,
      ttsEnabled,
    )

    return { original: text, language, translations, audioBase64 }
  }

  /**
   * Groq Cloud API — Whisper large-v3-turbo on LPU inference.
   * Accepts WebM/Opus directly (no ffmpeg conversion needed).
   * Latency: ~150-300ms vs 2-3s local CPU.
   *
   * IMPORTANT: Do NOT pass language parameter — let Groq auto-detect.
   * Forced language hints cause Whisper to hallucinate (e.g. forcing "en" on
   * Vietnamese audio produces garbage English phrases like "Thank you.").
   * Large-v3-turbo auto-detects vi/en/ja with >95% accuracy.
   */
  private async transcribeWithGroq(
    audioBuffer: Buffer,
    _languageHint?: string,
  ): Promise<{ text: string; language: string }> {
    const boundary = `----GroqBoundary${Date.now().toString(36)}`
    const parts: Buffer[] = []

    // File part — send as WebM (Groq accepts it natively, no ffmpeg needed)
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="audio.webm"\r\nContent-Type: audio/webm\r\n\r\n`,
      ),
    )
    parts.push(audioBuffer)
    parts.push(Buffer.from('\r\n'))

    // Model
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-large-v3-turbo\r\n`,
      ),
    )

    // Deterministic output
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="temperature"\r\n\r\n0.0\r\n`,
      ),
    )

    // NOTE: no_speech_threshold and logprob_threshold are NOT valid Groq API parameters —
    // they are silently ignored. Anti-hallucination for the Groq path relies on:
    //   1. Client-side VAD (RMS threshold + MIN_SPEECH_MS in useMeeting.ts)
    //   2. isWhisperHallucination() pattern filter in meetings.gateway.ts
    //   3. temperature=0.0 above (deterministic, reduces creative hallucination)
    // Do NOT add a `prompt` here: a prompt in any specific language biases Whisper
    // toward that language and degrades auto-detection for vi/ja speakers.

    // Close boundary
    parts.push(Buffer.from(`--${boundary}--\r\n`))

    const body = Buffer.concat(parts)
    const startTime = Date.now()

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.groqApiKey}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body,
      signal: AbortSignal.timeout(10000),
    })

    const elapsed = Date.now() - startTime
    this.logger.log(`[groq] transcription took ${elapsed}ms`)

    if (!response.ok) {
      const statusText = response.statusText
      throw new Error(`Groq returned ${response.status} ${statusText}`)
    }

    const data = (await response.json()) as { text: string; language?: string }

    // Groq often returns lang=en even for vi/ja text — detect from the text itself
    const detectedLanguage = this.detectLanguageFromText(data.text ?? '')

    return { text: data.text ?? '', language: detectedLanguage }
  }

  private async transcribeWithLocalWhisper(
    audioBuffer: Buffer,
    languageHint?: string,
    isScreenAudio = false,
  ): Promise<{ text: string; language: string }> {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 45000)

      const parameters = new URLSearchParams()
      // Only pass the language hint when it is 'vi' or 'ja' — these constrain Whisper to the
      // expected CJK/Vietnamese token space and improve accuracy for those speakers.
      // Never force 'en' on local Whisper: Vietnamese/Japanese speakers whose UI language is
      // English would have speakerLanguage='en' by default before speaking language is set,
      // causing Whisper to output garbled English from perfectly clear Vietnamese/Japanese speech.
      if (languageHint === 'vi' || languageHint === 'ja') {
        parameters.set('language', languageHint)
      }
      if (isScreenAudio) parameters.set('screen_audio', '1')
      const query = parameters.toString()
      const url = query ? `${this.whisperUrl}/transcribe?${query}` : `${this.whisperUrl}/transcribe`

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: new Uint8Array(audioBuffer),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        this.logger.error(`Whisper returned ${response.status}`)

        return { text: '', language: 'en' }
      }

      const data = (await response.json()) as { text: string; language: string }

      const text = data.text ?? ''
      // Cross-check Whisper's reported language against the actual text content.
      // When a language hint was passed, Whisper always echoes that hint in info.language even
      // if the text itself is in a different language (e.g. forced 'vi' but audio was Japanese).
      // detectLanguageFromText overrides the reported language when character analysis disagrees.
      const language = this.detectLanguageFromText(text) || data.language || 'en'

      return { text, language }
    } catch (error) {
      this.logger.error('Whisper transcription failed', error)

      return { text: '', language: 'en' }
    }
  }

  /**
   * Detect language from transcribed text by analyzing character ranges.
   * Groq's language field is unreliable — often returns "en" for Japanese/Vietnamese.
   */
  private detectLanguageFromText(text: string): string {
    // Japanese: hiragana (3040-309F), katakana (30A0-30FF), kanji (4E00-9FFF)
    const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/
    if (japaneseRegex.test(text)) return 'ja'

    // Vietnamese: characters unique to Vietnamese that do not appear in any other Latin-script language.
    // Covers all tonal + vowel variants:
    //   ă/â and their toned forms (ắ ằ ẳ ẵ ặ / ấ ầ ẩ ẫ ậ)
    //   đ (d-stroke)
    //   ê and toned (ế ề ể ễ ệ)
    //   ô and toned (ố ồ ổ ỗ ộ)
    //   ơ and toned (ớ ờ ở ỡ ợ)
    //   ư and toned (ứ ừ ử ữ ự)
    //   i with hooks/tones below/above (ị ỉ ĩ)
    //   o with hooks/tones (ọ ỏ)
    //   u with hooks/tones (ụ ủ ũ)
    //   e with hooks/tones (ẹ ẻ ẽ)
    //   y with hooks/tones (ỵ ỷ ỹ)
    const vietnameseRegex =
      /[ăắằẳẵặâấầẩẫậđêếềểễệôốồổỗộơớờởỡợưứừửữựịỉĩọỏụủũẹẻẽỵỷỹĂẮẰẲẴẶÂẤẦẨẪẬĐÊẾỀỂỄỆÔỐỒỔỖỘƠỚỜỞỠỢƯỨỪỬỮỰỊỈĨỌỎỤỦŨẸẺẼỴỶỸ]/
    if (vietnameseRegex.test(text)) return 'vi'

    // Default: English
    return 'en'
  }
}
