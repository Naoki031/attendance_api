import { Module } from '@nestjs/common'
import { FirebaseService } from './firebase.service'
import { ErrorLogsModule } from '@/modules/error_logs/error_logs.module'

@Module({
  imports: [ErrorLogsModule],
  providers: [FirebaseService],
  exports: [FirebaseService],
})
export class FirebaseModule {}
