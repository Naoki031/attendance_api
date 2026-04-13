import { Injectable, Logger } from '@nestjs/common'
import { TranslateService } from '../translate/translate.service'
import { MessagesService } from '../messages/messages.service'
import { ErrorLogsService } from '@/modules/error_logs/error_logs.service'

const SUPPORTED_LANGUAGES = ['en', 'vi', 'ja']

export interface BroadcastPayload {
  id: number
  roomId: number
  userId: number
  username: string
  avatar: string
  content: string
  detectedLang: string
  translations: Record<string, string>
  isEdited: boolean
  parentId: number | null
  createdAt: Date
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name)

  constructor(
    private readonly errorLogsService: ErrorLogsService,
    private readonly translateService: TranslateService,
    private readonly messagesService: MessagesService,
  ) {}

  private getGlossaryTerms(): string[] {
    // Attendance-domain vocabulary that must translate consistently across all messages.
    // These are business terms specific to this app — AI must use the same translation every time.
    return [
      'leave request → yêu cầu nghỉ phép (vi) / 休暇申請 (ja)',
      'approve → duyệt (vi) / 承認 (ja)',
      'reject → từ chối (vi) / 却下 (ja)',
      'pending → chờ duyệt (vi) / 保留中 (ja)',
      'attendance → chấm công (vi) / 勤怠 (ja)',
      'payroll → bảng lương (vi) / 給与 (ja)',
    ]
  }

  async sendMessage(parameters: {
    roomId: number
    userId: number
    username: string
    avatar: string
    content: string
  }): Promise<BroadcastPayload> {
    try {
      const detectedLang = this.translateService.isTranslatableContent(parameters.content)
        ? await this.translateService.detectLanguage(parameters.content)
        : 'unknown'

      const message = await this.messagesService.create({
        roomId: parameters.roomId,
        userId: parameters.userId,
        content: parameters.content,
        detectedLang,
      })

      return {
        id: message.id,
        roomId: parameters.roomId,
        userId: parameters.userId,
        username: parameters.username,
        avatar: parameters.avatar,
        content: parameters.content,
        detectedLang,
        translations: {},
        isEdited: false,
        parentId: null,
        createdAt: message.created_at,
      }
    } catch (error) {
      this.logger.error('Failed to send message', error)
      this.errorLogsService.logError({
        message: 'Failed to send message',
        stackTrace: (error as Error).stack ?? null,
        path: 'chat',
      })
      throw error
    }
  }

  async sendThreadReply(parameters: {
    roomId: number
    parentId: number
    userId: number
    username: string
    avatar: string
    content: string
  }): Promise<BroadcastPayload> {
    try {
      const parentMessage = await this.messagesService.findOne(parameters.parentId)

      if (!parentMessage) {
        throw new Error('Parent message not found')
      }

      const detectedLang = this.translateService.isTranslatableContent(parameters.content)
        ? await this.translateService.detectLanguage(parameters.content)
        : 'unknown'

      const message = await this.messagesService.create({
        roomId: parameters.roomId,
        userId: parameters.userId,
        content: parameters.content,
        detectedLang,
        parentId: parameters.parentId,
      })

      return {
        id: message.id,
        roomId: parameters.roomId,
        userId: parameters.userId,
        username: parameters.username,
        avatar: parameters.avatar,
        content: parameters.content,
        detectedLang,
        translations: {},
        isEdited: false,
        parentId: parameters.parentId,
        createdAt: message.created_at,
      }
    } catch (error) {
      this.logger.error('Failed to send thread reply', error)
      this.errorLogsService.logError({
        message: 'Failed to send thread reply',
        stackTrace: (error as Error).stack ?? null,
        path: 'chat',
      })
      throw error
    }
  }

  async translateMessage(parameters: {
    messageId: number
    content: string
    detectedLang: string
    roomId: number
    onChunk?: (lang: string, chunk: string) => void
    forceRefresh?: boolean
  }): Promise<Record<string, string>> {
    try {
      if (parameters.detectedLang === 'unknown') return {}

      const targetLangs = SUPPORTED_LANGUAGES.filter(
        (language) => language !== parameters.detectedLang,
      )
      const glossary = this.getGlossaryTerms()

      // Strip leading quote block before translating, then reattach to each translation
      let quotePrefix: string | null = null
      let textToTranslate = parameters.content

      if (parameters.content.startsWith('> ')) {
        const newlineIndex = parameters.content.indexOf('\n')

        if (newlineIndex !== -1) {
          quotePrefix = parameters.content.substring(0, newlineIndex + 1)
          textToTranslate = parameters.content.substring(newlineIndex + 1)
        }
      }

      // When there's a quote prefix, stream without the prefix and reattach only in final result
      const translations = await this.translateService.getOrCreateTranslations(
        parameters.messageId,
        textToTranslate,
        parameters.detectedLang,
        targetLangs,
        glossary,
        parameters.onChunk,
        parameters.forceRefresh ?? false,
      )

      if (quotePrefix) {
        return Object.fromEntries(
          Object.entries(translations).map(([lang, text]) => [lang, `${quotePrefix}${text}`]),
        )
      }

      return translations
    } catch (error) {
      this.logger.error('Failed to translate message', error)
      this.errorLogsService.logError({
        message: 'Failed to translate message',
        stackTrace: (error as Error).stack ?? null,
        path: 'chat',
      })
      return {}
    }
  }

  async deleteMessage(parameters: { messageId: number; userId: number }): Promise<void> {
    try {
      const message = await this.messagesService.findOne(parameters.messageId)

      if (!message) {
        throw new Error('Message not found')
      }

      if (message.user_id !== parameters.userId) {
        throw new Error('You can only delete your own messages')
      }

      const fifteenMinutesMs = 15 * 60 * 1000
      const elapsed = Date.now() - new Date(message.created_at).getTime()

      if (elapsed > fifteenMinutesMs) {
        throw new Error('Messages can only be deleted within 15 minutes')
      }

      await this.messagesService.softDelete(parameters.messageId)
      await this.translateService.invalidateCache(parameters.messageId)
    } catch (error) {
      this.logger.error('Failed to delete message', error)
      this.errorLogsService.logError({
        message: 'Failed to delete message',
        stackTrace: (error as Error).stack ?? null,
        path: 'chat',
      })
      throw error
    }
  }

  async editMessage(parameters: {
    messageId: number
    userId: number
    roomId: number
    newContent: string
    username: string
    avatar: string
  }): Promise<BroadcastPayload> {
    try {
      const message = await this.messagesService.findOne(parameters.messageId)

      if (!message) {
        throw new Error('Message not found')
      }

      if (message.user_id !== parameters.userId) {
        throw new Error('You can only edit your own messages')
      }

      const fifteenMinutesMs = 15 * 60 * 1000
      const elapsed = Date.now() - new Date(message.created_at).getTime()

      if (elapsed > fifteenMinutesMs) {
        throw new Error('Messages can only be edited within 15 minutes')
      }

      const updatedMessage = await this.messagesService.update(parameters.messageId, {
        content: parameters.newContent,
        previousContent: message.content,
      })

      const detectedLang = this.translateService.isTranslatableContent(parameters.newContent)
        ? await this.translateService.detectLanguage(parameters.newContent)
        : 'unknown'

      return {
        id: updatedMessage.id,
        roomId: parameters.roomId,
        userId: parameters.userId,
        username: parameters.username,
        avatar: parameters.avatar,
        content: parameters.newContent,
        detectedLang,
        translations: {},
        isEdited: true,
        parentId: message.parent_id,
        createdAt: updatedMessage.created_at,
      }
    } catch (error) {
      this.logger.error('Failed to edit message', error)
      this.errorLogsService.logError({
        message: 'Failed to edit message',
        stackTrace: (error as Error).stack ?? null,
        path: 'chat',
      })
      throw error
    }
  }
}
