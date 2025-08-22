import { Module } from '@nestjs/common';
import { RolesService } from './roles.service';
import { RolesController } from './roles.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { rolesProviders } from './roles.provider';
import { Role } from './entities/role.entity';
import { UserGroupPermissionsModule } from '@/modules/user_group_permissions/user_group_permissions.module';

@Module({
  imports: [TypeOrmModule.forFeature([Role]), UserGroupPermissionsModule],
  controllers: [RolesController],
  providers: [RolesService, ...rolesProviders],
})
export class RolesModule {}
