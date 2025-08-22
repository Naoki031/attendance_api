import { Module } from '@nestjs/common';
import { PermissionGroupsService } from './permission_groups.service';
import { PermissionGroupsController } from './permission_groups.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { permissionGroupsProviders } from './permission_groups.provider';
import { PermissionGroup } from './entities/permission_group.entity';
import { UserGroupPermissionsModule } from '@/modules/user_group_permissions/user_group_permissions.module';
import { UsersModule } from '@/modules/users/users.module';
@Module({
  imports: [TypeOrmModule.forFeature([PermissionGroup]), UserGroupPermissionsModule, UsersModule],
  controllers: [PermissionGroupsController],
  providers: [PermissionGroupsService, ...permissionGroupsProviders],
})
export class PermissionGroupsModule {}
