import { Controller, Get, Patch, Post, Param, ParseIntPipe } from '@nestjs/common'
import { NotificationsService } from './notifications.service'
import { User } from '@/modules/auth/decorators/user.decorator'

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * Returns the latest 50 notifications for the current user plus their unread count.
   * All authenticated users can access their own notifications — scoped by user.id in service.
   */
  @Get()
  findForMe(@User() user: { id: number }) {
    return this.notificationsService.findForUser(user.id)
  }

  /**
   * Marks a single notification as read.
   */
  @Patch(':id/read')
  markAsRead(@Param('id', ParseIntPipe) id: number, @User() user: { id: number }) {
    return this.notificationsService.markAsRead(id, user.id)
  }

  /**
   * Marks all unread notifications as read for the current user.
   */
  @Post('read-all')
  markAllAsRead(@User() user: { id: number }) {
    return this.notificationsService.markAllAsRead(user.id)
  }
}
