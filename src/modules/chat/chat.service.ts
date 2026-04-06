import { Injectable, Logger } from '@nestjs/common'
import { TranslateService } from '../translate/translate.service'
import { MessagesService } from '../messages/messages.service'

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
    private readonly translateService: TranslateService,
    private readonly messagesService: MessagesService,
  ) {}

  private async getGlossaryTerms(_roomId: number): Promise<string[]> {
    try {
      return []
    } catch (error) {
      this.logger.error('Failed to get glossary terms', error)
      return []
    }
  }

  async sendMessage(parameters: {
    roomId: number
    userId: number
    username: string
    avatar: string
    content: string
  }): Promise<BroadcastPayload> {
    const detectedLang = await this.translateService.detectLanguage(parameters.content)

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
  }

  async sendThreadReply(parameters: {
    roomId: number
    parentId: number
    userId: number
    username: string
    avatar: string
    content: string
  }): Promise<BroadcastPayload> {
    const parentMessage = await this.messagesService.findOne(parameters.parentId)

    if (!parentMessage) {
      throw new Error('Parent message not found')
    }

    const detectedLang = await this.translateService.detectLanguage(parameters.content)

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
  }

  async translateMessage(parameters: {
    messageId: number
    content: string
    detectedLang: string
    roomId: number
    onChunk?: (lang: string, chunk: string) => void
  }): Promise<Record<string, string>> {
    const targetLangs = SUPPORTED_LANGUAGES.filter(
      (language) => language !== parameters.detectedLang,
    )
    const glossary = await this.getGlossaryTerms(parameters.roomId)

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
    )

    if (quotePrefix) {
      return Object.fromEntries(
        Object.entries(translations).map(([lang, text]) => [lang, `${quotePrefix}${text}`]),
      )
    }

    return translations
  }

  async editMessage(parameters: {
    messageId: number
    userId: number
    roomId: number
    newContent: string
    username: string
    avatar: string
  }): Promise<BroadcastPayload> {
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

    // Content changed — old translations are stale
    await this.translateService.invalidateCache(parameters.messageId)

    const detectedLang = await this.translateService.detectLanguage(parameters.newContent)

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
  }
}
