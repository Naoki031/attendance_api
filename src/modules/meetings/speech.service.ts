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

  constructor(
    private readonly configService: ConfigService,
    private readonly translateService: TranslateService,
    private readonly ttsService: TtsService,
  ) {
    this.whisperUrl = this.configService.get<string>('WHISPER_URL') ?? 'http://whisper:5001'
  }

  async transcribeOnly(
    audioBuffer: Buffer,
    languageHint?: string,
    isScreenAudio = false,
  ): Promise<{ text: string; language: string }> {
    return this.transcribe(audioBuffer, languageHint, isScreenAudio)
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
    const { text, language } = await this.transcribe(audioBuffer, languageHint, isScreenAudio)

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

  private async transcribe(
    audioBuffer: Buffer,
    languageHint?: string,
    isScreenAudio = false,
  ): Promise<{ text: string; language: string }> {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 45000)

      const parameters = new URLSearchParams()
      if (languageHint) parameters.set('language', languageHint)
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

      return { text: data.text ?? '', language: data.language ?? 'en' }
    } catch (error) {
      this.logger.error('Whisper transcription failed', error)

      return { text: '', language: 'en' }
    }
  }
}
