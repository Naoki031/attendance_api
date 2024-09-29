import { Module } from '@nestjs/common';
import { PermissionGroupsService } from './permission_groups.service';
import { PermissionGroupsController } from './permission_groups.controller';

@Module({
  controllers: [PermissionGroupsController],
  providers: [PermissionGroupsService],
})
export class PermissionGroupsModule {}
