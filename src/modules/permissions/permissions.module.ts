import { Module } from '@nestjs/common';
import { PermissionsService } from './permissions.service';
import { PermissionsController } from './permissions.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { permissionsProviders } from './permissions.provider';
import { Permission } from './entities/permission.entity';
import { UserGroupPermissionsModule } from '@/modules/user_group_permissions/user_group_permissions.module';

@Module({
  imports: [TypeOrmModule.forFeature([Permission]), UserGroupPermissionsModule],
  controllers: [PermissionsController],
  providers: [PermissionsService, ...permissionsProviders],
  exports: [PermissionsService], // Exporting the service for use in other modules
})
export class PermissionsModule {}
