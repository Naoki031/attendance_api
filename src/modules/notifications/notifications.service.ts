import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, LessThan } from 'typeorm'
import moment from 'moment-timezone'
import { Notification } from './entities/notification.entity'
import { ErrorLogsService } from '@/modules/error_logs/error_logs.service'

export interface CreateNotificationData {
  userId: number
  type: string
  title: string
  body?: string
  icon?: string
  iconColor?: string
  route?: string
  data?: Record<string, unknown>
}

export interface NotificationListResult {
  items: Notification[]
  unreadCount: number
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name)

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    private readonly errorLogsService: ErrorLogsService,
  ) {}

  /**
   * Creates a notification row for a single user and returns the saved entity.
   */
  async create(data: CreateNotificationData): Promise<Notification> {
    try {
      const notification = this.notificationRepository.create({
        user_id: data.userId,
        type: data.type,
        title: data.title,
        body: data.body,
        icon: data.icon,
        icon_color: data.iconColor,
        route: data.route,
        data: data.data,
        is_read: false,
      })
      return await this.notificationRepository.save(notification)
    } catch (error) {
      this.logger.error('Failed to create notification', error)
      this.errorLogsService.logError({
        message: 'Failed to create notification',
        stackTrace: (error as Error).stack ?? null,
        path: 'notifications',
        userId: data.userId,
      })
      throw error
    }
  }

  /**
   * Returns the latest notifications for a user (max 50) plus an unread count.
   */
  async findForUser(userId: number): Promise<NotificationListResult> {
    try {
      const [items, unreadCount] = await Promise.all([
        this.notificationRepository.find({
          where: { user_id: userId },
          order: { created_at: 'DESC' },
          take: 50,
        }),
        this.notificationRepository.count({
          where: { user_id: userId, is_read: false },
        }),
      ])
      return { items, unreadCount }
    } catch (error) {
      this.logger.error('Failed to fetch notifications', error)
      this.errorLogsService.logError({
        message: 'Failed to fetch notifications',
        stackTrace: (error as Error).stack ?? null,
        path: 'notifications',
        userId,
      })
      throw error
    }
  }

  /**
   * Marks a single notification as read. Ignores if not owned by userId.
   */
  async markAsRead(id: number, userId: number): Promise<void> {
    try {
      await this.notificationRepository.update(
        { id, user_id: userId, is_read: false },
        { is_read: true, read_at: moment.utc().toDate() },
      )
    } catch (error) {
      this.logger.error('Failed to mark notification as read', error)
      this.errorLogsService.logError({
        message: 'Failed to mark notification as read',
        stackTrace: (error as Error).stack ?? null,
        path: 'notifications',
        userId,
      })
      throw error
    }
  }

  /**
   * Marks all unread notifications for a user as read.
   */
  async markAllAsRead(userId: number): Promise<void> {
    try {
      await this.notificationRepository.update(
        { user_id: userId, is_read: false },
        { is_read: true, read_at: moment.utc().toDate() },
      )
    } catch (error) {
      this.logger.error('Failed to mark all notifications as read', error)
      this.errorLogsService.logError({
        message: 'Failed to mark all notifications as read',
        stackTrace: (error as Error).stack ?? null,
        path: 'notifications',
        userId,
      })
      throw error
    }
  }

  /**
   * Deletes notifications older than 30 days. Called periodically to keep the table lean.
   */
  async pruneOld(): Promise<void> {
    const cutoff = moment.utc().subtract(30, 'days').toDate()
    await this.notificationRepository.delete({ created_at: LessThan(cutoff) })
  }
}
