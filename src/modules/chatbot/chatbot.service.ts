import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import Anthropic from '@anthropic-ai/sdk'
import type { ChatMessageItemDto } from './dto/chat-message.dto'
import { PromptBuilderService } from './prompt-builder/prompt-builder.service'

@Injectable()
export class ChatbotService {
  private readonly logger = new Logger(ChatbotService.name)
  private client: Anthropic | null = null
  private model: string = 'claude-sonnet-4-6'

  constructor(
    private readonly configService: ConfigService,
    private readonly promptBuilder: PromptBuilderService,
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
   * @param tone     - Optional tone override: 'professional' | 'friendly' | 'concise'
   * @param language - Optional detected language of the user's message (e.g. 'Vietnamese')
   * @param isAdmin  - Whether the requesting user has admin/super_admin role (determined from JWT)
   */
  async chat(
    messages: ChatMessageItemDto[],
    tone?: string,
    language?: string,
    isAdmin = false,
  ): Promise<{ reply: string; suggestions: string[] }> {
    if (!this.client) {
      return { reply: 'Chatbot is not configured. Please set ANTHROPIC_API_KEY.', suggestions: [] }
    }

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1024,
        system: this.promptBuilder.buildSystemPrompt({ tone, language, isAdmin }),
        messages: messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
      })

      const block = response.content[0]
      const rawText = block.type === 'text' ? block.text : ''

      return this.parseResponse(rawText)
    } catch (error) {
      this.logger.error('Failed to get chatbot response', error)

      throw error
    }
  }
}
