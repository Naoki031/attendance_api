import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import type { PromptSection, PromptRole, DataContext } from './types'
import { ChatbotCacheService } from '../cache/chatbot-cache.service'
import { ErrorLogsService } from '@/modules/error_logs/error_logs.service'

const TONE_INSTRUCTIONS: Record<string, string> = {
  professional: `

## Communication Style
- Use formal, polite language (Vietnamese: xưng "tôi", gọi "bạn" hoặc "quý khách")
- Be respectful and courteous at all times
- Use complete sentences and proper grammar
- Avoid slang, casual expressions, or overly informal phrasing`,

  friendly: `

## Communication Style
- Be warm, approachable, and encouraging
- Use a conversational tone while remaining professional and respectful
- Feel free to use light, positive language to put users at ease
- Avoid being stiff or overly formal, but stay helpful and clear`,

  concise: `

## Communication Style
- Be brief and direct — answer the question without unnecessary filler
- Use bullet points and short sentences
- Skip pleasantries unless the user initiates them
- Prioritize clarity and speed over elaboration`,

  rapper: `

## Communication Style
- Respond in rap style — use rhymes, rhythm, and flow in every answer
- Keep it fun and energetic but still accurate and helpful
- Weave casual slang naturally into rhyming couplets or bars
- Each answer should feel like a verse, not a lecture
- Maintain the rap vibe even when explaining technical steps`,
}

@Injectable()
export class PromptBuilderService implements OnModuleInit {
  private readonly logger = new Logger(PromptBuilderService.name)
  private sections: PromptSection[] = []
  private assembledPrompts: Map<string, string> = new Map()
  private defaultTone: string = 'professional'

  constructor(
    private readonly configService: ConfigService,
    private readonly cacheService: ChatbotCacheService,
    private readonly errorLogsService: ErrorLogsService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.loadSections()
      this.assembleAll()
    } catch (error) {
      this.logger.error('Failed to initialize prompt sections', error)
      this.errorLogsService.logError({
        message: 'Failed to initialize prompt sections',
        stackTrace: (error as Error).stack ?? null,
        path: 'prompt_builder',
      })
      throw error
    }
  }

  private resolvePromptsDir(): string {
    // In development, read directly from src/ to avoid asset-copy delays with Docker on macOS.
    // In production, dist/ is the only available path.
    if (process.env.NODE_ENV !== 'production') {
      return path.resolve(process.cwd(), 'src', 'modules', 'chatbot', 'prompts')
    }
    return path.resolve(__dirname, '..', 'prompts')
  }

  private async loadSections(): Promise<void> {
    const directory = this.resolvePromptsDir()
    const files = await fs.readdir(directory)
    const mdFiles = files.filter((file) => file.endsWith('.md')).sort()

    this.sections = []

    for (const file of mdFiles) {
      const raw = await fs.readFile(path.join(directory, file), 'utf-8')
      const parsed = this.parseFrontmatter(raw, file)
      this.sections.push(parsed)
    }

    this.logger.log(`Loaded ${this.sections.length} prompt sections from ${directory}`)
  }

  private parseFrontmatter(raw: string, filename: string): PromptSection {
    const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)

    if (!match) {
      throw new Error(`Prompt file "${filename}" is missing valid YAML frontmatter`)
    }

    const [, yamlBlock, body] = match
    const parsed: Record<string, unknown> = {}

    for (const line of yamlBlock.split('\n')) {
      const [key, ...rest] = line.split(':')
      if (!key || rest.length === 0) continue
      const value = rest.join(':').trim()

      if (value.startsWith('[') && value.endsWith(']')) {
        parsed[key.trim()] = value
          .slice(1, -1)
          .split(',')
          .map((item: string) => item.trim())
      } else {
        parsed[key.trim()] = isNaN(Number(value)) ? value : Number(value)
      }
    }

    return {
      id: path.basename(filename, '.md'),
      tags: (parsed.tags as string[]) ?? [],
      order: (parsed.order as number) ?? 999,
      body: body.trim(),
    }
  }

  private assembleAll(): void {
    this.assembledPrompts.clear()
    const roles: PromptRole[] = ['employee', 'admin']

    for (const role of roles) {
      const prompt = this.assembleForRole(role)
      this.assembledPrompts.set(role, prompt)
      this.logger.log(`Assembled ${role} prompt: ${prompt.length} chars`)
    }
  }

  private assembleForRole(role: PromptRole): string {
    return this.sections
      .filter((section) => section.tags.includes(role))
      .sort((sectionA, sectionB) => sectionA.order - sectionB.order)
      .map((section) => section.body)
      .join('\n\n')
  }

  /**
   * Returns the pre-assembled base prompt for the given role.
   * Fast path — no file I/O, reads from memory cache.
   */
  getBasePrompt(role: PromptRole): string {
    try {
      return this.assembledPrompts.get(role) ?? ''
    } catch (error) {
      this.logger.error('Failed to get base prompt', error)
      this.errorLogsService.logError({
        message: 'Failed to get base prompt',
        stackTrace: (error as Error).stack ?? null,
        path: 'prompt_builder',
      })
      throw error
    }
  }

  /**
   * Builds the full system prompt including base prompt, tone, language,
   * follow-up suggestions, and optional data context.
   */
  buildSystemPrompt(options: {
    tone?: string
    language?: string
    isAdmin: boolean
    dataContext?: DataContext
  }): string {
    try {
      const { tone, language, isAdmin, dataContext } = options
      const role: PromptRole = isAdmin ? 'admin' : 'employee'
      const resolvedTone = tone && TONE_INSTRUCTIONS[tone] ? tone : this.defaultTone
      const chatbotName = this.configService.get<string>('CHATBOT_NAME')

      let prompt = this.getBasePrompt(role) + (TONE_INSTRUCTIONS[resolvedTone] ?? '')

      if (chatbotName) {
        prompt =
          `Your name is "${chatbotName}". When users ask your name, introduce yourself as ${chatbotName}.\n\n` +
          prompt
      }

      if (language) {
        prompt += `\n\nIMPORTANT: The user is communicating in ${language}. You MUST respond in ${language} only. Do not switch languages.`
      }

      if (dataContext && Object.keys(dataContext).length > 0) {
        prompt += '\n\n## Current System Data\n'

        for (const [key, value] of Object.entries(dataContext)) {
          prompt += `- ${key}: ${value}\n`
        }
      }

      prompt += `

## Follow-up Suggestions
After every response, append exactly 3 short follow-up questions the user might want to ask next.
Format them strictly as:
<suggestions>
Question 1?
Question 2?
Question 3?
</suggestions>
Rules:
- Write the suggestions in the same language as the rest of your response.
- Each suggestion must be on its own line.
- Do not add labels, numbers, or extra text inside the block.
- The <suggestions> block must always be the very last thing in your response.${
        !isAdmin
          ? '\n- Only suggest questions about features available to regular employees: Home page, My Requests, Profile, clock-in/out methods, and request submission. Do NOT suggest questions about admin-only features such as approvals, user management, attendance logs, QR code generation, Slack configuration, or system settings.'
          : ''
      }`

      return prompt
    } catch (error) {
      this.logger.error('Failed to build system prompt', error)
      this.errorLogsService.logError({
        message: 'Failed to build system prompt',
        stackTrace: (error as Error).stack ?? null,
        path: 'prompt_builder',
      })
      throw error
    }
  }

  /**
   * Returns the section IDs that make up the prompt for a given role.
   * Used by cache to track dependencies for invalidation.
   */
  getSectionIdsForRole(role: PromptRole): string[] {
    return this.sections
      .filter((section) => section.tags.includes(role))
      .sort((sectionA, sectionB) => sectionA.order - sectionB.order)
      .map((section) => section.id)
  }

  /**
   * Returns the number of loaded sections (for the reload endpoint).
   */
  getSectionCount(): number {
    try {
      return this.sections.length
    } catch (error) {
      this.logger.error('Failed to get section count', error)
      this.errorLogsService.logError({
        message: 'Failed to get section count',
        stackTrace: (error as Error).stack ?? null,
        path: 'prompt_builder',
      })
      throw error
    }
  }

  /**
   * Reloads all prompt sections from disk and reassembles.
   * Compares section hashes to auto-invalidate cache entries affected by changes.
   */
  async reload(): Promise<void> {
    try {
      this.logger.log('Reloading prompt sections from disk...')
      await this.loadSections()
      this.assembleAll()

      // Sync section hashes with DB and invalidate affected cache entries
      const currentSections = this.sections.map((section) => ({
        id: section.id,
        body: section.body,
      }))
      await this.cacheService.syncSectionHashesAndGetChanged(currentSections)
    } catch (error) {
      this.logger.error('Failed to reload prompt sections', error)
      this.errorLogsService.logError({
        message: 'Failed to reload prompt sections',
        stackTrace: (error as Error).stack ?? null,
        path: 'prompt_builder',
      })
      throw error
    }
  }
}
