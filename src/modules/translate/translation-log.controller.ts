import { Controller, Get, Post, Query, Body, ValidationPipe, UseGuards } from '@nestjs/common'
import { TranslationLogService } from './translation-log.service'
import { QueryTranslationLogDto } from './dto/query-translation-log.dto'
import { PermissionsGuard } from '@/modules/permissions/guards/permissions.guard'
import { Permissions } from '@/modules/permissions/decorators/permissions.decorator'

@Controller('translation-logs')
@UseGuards(PermissionsGuard)
export class TranslationLogController {
  constructor(private readonly translationLogService: TranslationLogService) {}

  @Get()
  @Permissions('all_privileges', 'read')
  findAll(@Query(new ValidationPipe({ transform: true })) query: QueryTranslationLogDto) {
    return this.translationLogService.findAll(query)
  }

  @Get('stats')
  @Permissions('all_privileges', 'read')
  getStats() {
    return this.translationLogService.getStats()
  }

  @Get('cache-breakdown')
  @Permissions('all_privileges', 'read')
  getCacheBreakdown() {
    return this.translationLogService.getCacheBreakdown()
  }

  @Post('purge')
  @Permissions('all_privileges', 'delete')
  async purge(@Body(ValidationPipe) body: { olderThanDays: number }) {
    const deleted = await this.translationLogService.purge(body.olderThanDays ?? 30)

    return { deleted }
  }
}
