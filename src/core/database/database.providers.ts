import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { databaseConfig } from './database.config';
import { Country } from '@/modules/countries/entities/country.entity';
import { Role } from '@/modules/roles/entities/role.entity';
import { Permission } from '@/modules/permissions/entities/permission.entity';
import { PermissionGroup } from '@/modules/permission_groups/entities/permission_group.entity';
import { User } from '@/modules/users/entities/user.entity';
import { UserGroupPermission } from '@/modules/user_group_permissions/entities/user_group_permission.entity';

export const DatabaseProvider = TypeOrmModule.forRootAsync({
  imports: [ConfigModule],

  useFactory: async () => {
    const config = databaseConfig[process.env.NODE_ENV];

    return {
      ...config,
      entities: [Country, Role, Permission, PermissionGroup, User, UserGroupPermission],
      migrationsTableName: 'migrations',
      namingStrategy: new SnakeNamingStrategy(),
      propertyNamingStrategy: 'snake_case',
    };
  },

  inject: [ConfigService],
});
