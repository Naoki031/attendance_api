import { Module } from '@nestjs/common'
import { PromptBuilderService } from './prompt-builder.service'
import { ErrorLogsModule } from '@/modules/error_logs/error_logs.module'

@Module({
  imports: [ErrorLogsModule],
  providers: [PromptBuilderService],
  exports: [PromptBuilderService],
})
export class PromptBuilderModule {}
