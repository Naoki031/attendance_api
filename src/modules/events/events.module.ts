import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { EventsGateway } from './events.gateway'
import { UserDepartment } from '@/modules/user_departments/entities/user_department.entity'
import { AuthModule } from '@/modules/auth/auth.module'

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([UserDepartment])],
  providers: [EventsGateway],
  exports: [EventsGateway],
})
export class EventsModule {}
