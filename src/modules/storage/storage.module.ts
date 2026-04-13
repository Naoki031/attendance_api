import { Module } from '@nestjs/common'
import { StorageController } from './storage.controller'
import { StorageService } from './storage.service'
import { ErrorLogsModule } from '@/modules/error_logs/error_logs.module'

@Module({
  imports: [ErrorLogsModule],
  controllers: [StorageController],
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
