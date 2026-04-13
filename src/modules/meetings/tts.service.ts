import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as textToSpeech from '@google-cloud/text-to-speech'
import { ErrorLogsService } from '@/modules/error_logs/error_logs.service'

const VOICE_MAP: Record<string, { languageCode: string; name: string }> = {
  vi: { languageCode: 'vi-VN', name: 'vi-VN-Wavenet-A' },
  en: { languageCode: 'en-US', name: 'en-US-Wavenet-D' },
  ja: { languageCode: 'ja-JP', name: 'ja-JP-Wavenet-A' },
}

@Injectable()
export class TtsService {
  private readonly logger = new Logger(TtsService.name)
  private client: textToSpeech.TextToSpeechClient | null = null

  constructor(
    private readonly configService: ConfigService,
    private readonly errorLogsService: ErrorLogsService,
  ) {
    const apiKey = this.configService.get<string>('GOOGLE_TTS_API_KEY')

    if (!apiKey) {
      this.logger.warn('TtsService disabled: GOOGLE_TTS_API_KEY is not set')

      return
    }

    this.client = new textToSpeech.TextToSpeechClient({ apiKey })
  }

  async synthesize(text: string, language: string): Promise<string | null> {
    if (!this.client || !text.trim()) return null

    const voice = VOICE_MAP[language] ?? VOICE_MAP['en']

    try {
      const [response] = await this.client.synthesizeSpeech({
        input: { text },
        voice,
        audioConfig: { audioEncoding: 'MP3' },
      })

      if (!response.audioContent) return null

      return Buffer.from(response.audioContent as Uint8Array).toString('base64')
    } catch (error) {
      this.logger.error(`TTS synthesis failed for lang=${language}`, error)
      this.errorLogsService.logError({
        message: `TTS synthesis failed for lang=${language}`,
        stackTrace: (error as Error).stack ?? null,
        path: 'tts_service',
      })

      return null
    }
  }
}
