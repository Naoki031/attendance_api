import { Injectable, NotFoundException, ConflictException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import { SlackChannel, SlackChannelFeature } from './entities/slack_channel.entity'
import { CreateSlackChannelDto } from './dto/create-slack_channel.dto'
import { UpdateSlackChannelDto } from './dto/update-slack_channel.dto'
import { HttpService } from '@nestjs/axios'
import { firstValueFrom } from 'rxjs'
import { User } from '@/modules/users/entities/user.entity'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class SlackChannelsService {
  constructor(
    @InjectRepository(SlackChannel)
    private readonly slackChannelRepository: Repository<SlackChannel>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Checks for an existing slack channel with the same company_id, feature, and channel_id.
   * Throws ConflictException if a duplicate is found (excluding the given excludeId for updates).
   */
  private async checkDuplicate(
    companyId: number | undefined,
    feature: string,
    channelId: string | undefined,
    excludeId?: number,
  ): Promise<void> {
    const query = this.slackChannelRepository
      .createQueryBuilder('slack_channel')
      .where('slack_channel.feature = :feature', { feature })

    if (companyId != null) {
      query.andWhere('slack_channel.company_id = :companyId', { companyId })
    } else {
      query.andWhere('slack_channel.company_id IS NULL')
    }

    if (channelId) {
      query.andWhere('slack_channel.channel_id = :channelId', { channelId })
    } else {
      query.andWhere('slack_channel.channel_id IS NULL')
    }

    if (excludeId != null) {
      query.andWhere('slack_channel.id != :excludeId', { excludeId })
    }

    const existing = await query.getOne()

    if (existing) {
      throw new ConflictException(
        'A slack channel with the same company, feature, and channel ID already exists',
      )
    }
  }

  /**
   * Creates a new slack channel entry.
   */
  async create(createDto: CreateSlackChannelDto): Promise<SlackChannel> {
    await this.checkDuplicate(createDto.company_id, createDto.feature, createDto.channel_id)

    return this.slackChannelRepository.save(createDto)
  }

  /**
   * Resolves mention_user_ids to full User objects and attaches them as mention_users.
   */
  private async populateMentionUsers(channels: SlackChannel[]): Promise<SlackChannel[]> {
    const allIds = [...new Set(channels.flatMap((channel) => channel.mention_user_ids ?? []))]
    if (allIds.length === 0) return channels

    const users = await this.userRepository.find({ where: { id: In(allIds) } })
    const userMap = new Map(users.map((user) => [user.id, user]))

    for (const channel of channels) {
      channel.mention_users = (channel.mention_user_ids ?? [])
        .map((id) => userMap.get(id))
        .filter((user): user is User => user != null)
    }

    return channels
  }

  /**
   * Retrieves all slack channels with company relation and resolved mention users.
   */
  async findAll(): Promise<SlackChannel[]> {
    const channels = await this.slackChannelRepository.find({ relations: ['company'] })
    return this.populateMentionUsers(channels)
  }

  /**
   * Retrieves a single slack channel by ID with resolved mention users.
   */
  async findOne(id: number): Promise<SlackChannel> {
    const item = await this.slackChannelRepository.findOne({
      where: { id },
      relations: ['company'],
    })
    if (!item) throw new NotFoundException('Slack channel not found')

    const [populated] = await this.populateMentionUsers([item])
    return populated!
  }

  /**
   * Updates a slack channel by ID.
   * webhook_url is only updated if explicitly provided (non-empty string).
   */
  async update(id: number, updateDto: UpdateSlackChannelDto): Promise<SlackChannel> {
    const current = await this.findOne(id)
    const companyId = updateDto.company_id !== undefined ? updateDto.company_id : current.company_id
    const feature = updateDto.feature ?? current.feature
    const channelId = updateDto.channel_id !== undefined ? updateDto.channel_id : current.channel_id
    await this.checkDuplicate(companyId, feature, channelId, id)

    const { webhook_url, ...rest } = updateDto
    const updatePayload = webhook_url ? { ...rest, webhook_url } : rest
    await this.slackChannelRepository.update({ id }, updatePayload)

    return this.findOne(id)
  }

  /**
   * Removes a slack channel by ID.
   */
  async remove(id: number): Promise<void> {
    await this.slackChannelRepository.delete({ id })
  }

  /**
   * Finds the first slack channel matching the given feature (and optional company).
   * Returns null if not found.
   */
  async findByFeature(
    feature: SlackChannelFeature,
    companyId?: number,
  ): Promise<SlackChannel | null> {
    const query = this.slackChannelRepository
      .createQueryBuilder('slack_channel')
      .where('slack_channel.feature = :feature', { feature })

    if (companyId) {
      query.andWhere('slack_channel.company_id = :companyId', { companyId })
    }

    return (await query.getOne()) ?? null
  }

  /**
   * Builds the mention prefix string for a Slack message.
   * Resolves mention_user_ids to their Slack IDs and appends group handles.
   * Returns an empty string if no mentions are configured.
   */
  private async buildMentionPrefix(channel: SlackChannel): Promise<string> {
    const parts: string[] = []

    if (channel.mention_user_ids && channel.mention_user_ids.length > 0) {
      const users = await this.userRepository.find({
        where: { id: In(channel.mention_user_ids) },
        select: ['id', 'slack_id'],
      })
      for (const user of users) {
        if (user.slack_id) {
          parts.push(`<@${user.slack_id}>`)
        }
      }
    }

    if (channel.mention_slack_group_handles && channel.mention_slack_group_handles.length > 0) {
      for (const handle of channel.mention_slack_group_handles) {
        if (handle === 'here' || handle === 'channel') {
          parts.push(`<!${handle}>`)
        } else {
          // Custom subteam ID, e.g. "S1234567" → <!subteam^S1234567>
          parts.push(`<!subteam^${handle}>`)
        }
      }
    }

    return parts.length > 0 ? parts.join(' ') + '\n' : ''
  }

  /**
   * Sends a message to the Slack channel matching the given feature.
   * Mentions configured users and groups, and appends optional action links.
   * If no channel is found for this feature, the message is silently skipped.
   */
  async sendMessage(
    feature: SlackChannelFeature,
    message: string,
    companyId?: number,
  ): Promise<void> {
    const queryBuilder = this.slackChannelRepository
      .createQueryBuilder('slack_channel')
      .where('slack_channel.feature = :feature', { feature })

    if (companyId) {
      queryBuilder.andWhere('slack_channel.company_id = :companyId', { companyId })
    }

    const channel = await queryBuilder.getOne()
    if (!channel) return

    let finalMessage = message

    const clientUrl = this.configService.get<string>('CLIENT_URL') ?? ''

    if (clientUrl) {
      const links: string[] = []
      if (channel.include_approval_link) {
        links.push(`<${clientUrl}/management/approvals|View Approvals>`)
      }
      if (channel.include_my_requests_link) {
        links.push(`<${clientUrl}/requests|View My Requests>`)
      }
      if (links.length > 0) {
        finalMessage += '\n' + links.join('   |   ')
      }
    }

    try {
      await firstValueFrom(this.httpService.post(channel.webhook_url, { text: finalMessage }))
    } catch (error) {
      console.error('Failed to send Slack message:', error)
    }
  }

  /**
   * Sends a user bug report to the Slack channel configured for the ERROR feature (via DB).
   * Mentions are prepended automatically based on the channel configuration.
   * If no error channel is configured for this company, the notification is silently skipped.
   */
  async sendError(message: string, companyId?: number): Promise<void> {
    const channel = await this.findByFeature(SlackChannelFeature.ERROR, companyId)
    if (!channel) return

    const mentionPrefix = await this.buildMentionPrefix(channel)
    await this.sendMessage(SlackChannelFeature.ERROR, mentionPrefix + message, companyId)
  }

  /**
   * Builds the mention prefix for system error messages from env vars.
   * Reads SLACK_ERROR_MENTION_USER_IDS (comma-separated Slack user IDs)
   * and SLACK_ERROR_MENTION_GROUPS (comma-separated group handles).
   */
  private buildSystemErrorMentionPrefix(): string {
    const parts: string[] = []

    const userIds = this.configService.get<string>('SLACK_ERROR_MENTION_USER_IDS') ?? ''
    for (const userId of userIds
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)) {
      parts.push(`<@${userId}>`)
    }

    const groups = this.configService.get<string>('SLACK_ERROR_MENTION_GROUPS') ?? ''
    for (const handle of groups
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)) {
      if (handle === 'here' || handle === 'channel') {
        parts.push(`<!${handle}>`)
      } else {
        parts.push(`<!subteam^${handle}>`)
      }
    }

    return parts.length > 0 ? parts.join(' ') + '\n' : ''
  }

  /**
   * Sends a system error notification directly to the webhook configured in SLACK_ERROR_WEBHOOK_URL env var.
   * Prepends mentions from SLACK_ERROR_MENTION_USER_IDS and SLACK_ERROR_MENTION_GROUPS if set.
   * Bypasses the slack_channels table — intended for internal/system errors (sync failures, etc.).
   * If SLACK_ERROR_WEBHOOK_URL is not set, the notification is silently skipped.
   */
  async sendSystemError(message: string): Promise<void> {
    const webhookUrl = this.configService.get<string>('SLACK_ERROR_WEBHOOK_URL')
    if (!webhookUrl) return

    const mentionPrefix = this.buildSystemErrorMentionPrefix()
    const finalMessage = mentionPrefix + message
    const channelId = this.configService.get<string>('SLACK_ERROR_CHANNEL_ID')
    const payload: Record<string, string> = { text: finalMessage }
    if (channelId) payload['channel'] = channelId

    try {
      await firstValueFrom(this.httpService.post(webhookUrl, payload))
    } catch (error) {
      console.error('Failed to send system error to Slack:', error)
    }
  }
}
