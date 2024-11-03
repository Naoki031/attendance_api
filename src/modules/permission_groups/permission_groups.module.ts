import { Module } from '@nestjs/common';
import { PermissionGroupsService } from './permission_groups.service';
import { PermissionGroupsController } from './permission_groups.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { permissionGroupsProviders } from './permission_groups.provider';
import { PermissionGroup } from './entities/permission_group.entity';
@Module({
  imports: [TypeOrmModule.forFeature([PermissionGroup])],
  controllers: [PermissionGroupsController],
  providers: [PermissionGroupsService, ...permissionGroupsProviders],
})
export class PermissionGroupsModule {}
