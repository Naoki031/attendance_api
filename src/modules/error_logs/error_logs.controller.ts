import {
  Controller,
  Get,
  Put,
  Post,
  Param,
  Query,
  Body,
  ParseIntPipe,
  ValidationPipe,
  UseGuards,
} from '@nestjs/common'
import { ErrorLogsService } from './error_logs.service'
import { QueryErrorLogDto } from './dto/query-error_log.dto'
import { ResolveBatchDto } from './dto/resolve-batch.dto'
import { PurgeErrorLogDto } from './dto/purge-error_log.dto'
import { PermissionsGuard } from '@/modules/permissions/guards/permissions.guard'
import { Permissions } from '@/modules/permissions/decorators/permissions.decorator'
import { User as UserEntity } from '@/modules/users/entities/user.entity'
import { User } from '@/modules/auth/decorators/user.decorator'

@Controller('error-logs')
@UseGuards(PermissionsGuard)
export class ErrorLogsController {
  constructor(private readonly errorLogsService: ErrorLogsService) {}

  @Get()
  @Permissions('all_privileges', 'read')
  findAll(
    @Query(new ValidationPipe({ transform: true }))
    query: QueryErrorLogDto,
  ) {
    return this.errorLogsService.findAll(query)
  }

  @Get('stats')
  @Permissions('all_privileges', 'read')
  getStats() {
    return this.errorLogsService.getStats()
  }

  @Get(':id')
  @Permissions('all_privileges', 'read')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.errorLogsService.findOne(id)
  }

  @Put(':id/resolve')
  @Permissions('all_privileges', 'update')
  resolve(@Param('id', ParseIntPipe) id: number, @User() user: UserEntity) {
    return this.errorLogsService.resolve(id, user.id)
  }

  @Put('resolve-batch')
  @Permissions('all_privileges', 'update')
  resolveBatch(@Body(ValidationPipe) body: ResolveBatchDto, @User() user: UserEntity) {
    return this.errorLogsService.resolveMany(body.ids, user.id)
  }

  @Post('purge')
  @Permissions('all_privileges', 'delete')
  async purge(@Body(ValidationPipe) body: PurgeErrorLogDto) {
    const deleted = await this.errorLogsService.purge(body.olderThanDays)

    return { deleted }
  }
}
