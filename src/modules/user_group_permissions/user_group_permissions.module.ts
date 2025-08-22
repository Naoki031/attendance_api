import { Module } from '@nestjs/common';
import { UserGroupPermissionsService } from './user_group_permissions.service';
import { UserGroupPermissionsController } from './user_group_permissions.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserGroupPermission } from './entities/user_group_permission.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserGroupPermission])],
  controllers: [UserGroupPermissionsController],
  providers: [UserGroupPermissionsService],
  exports: [UserGroupPermissionsService], // Exporting the service for use in other modules
})
export class UserGroupPermissionsModule { }
