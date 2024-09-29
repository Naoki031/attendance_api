import { Module } from '@nestjs/common';
import { UserGroupPermissionsService } from './user_group_permissions.service';
import { UserGroupPermissionsController } from './user_group_permissions.controller';

@Module({
  controllers: [UserGroupPermissionsController],
  providers: [UserGroupPermissionsService],
})
export class UserGroupPermissionsModule {}
