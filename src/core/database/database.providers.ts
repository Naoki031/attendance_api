import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { databaseConfig } from './database.config';
import { Country } from '../../modules/countries/entities/country.entity';
import { Role } from '../../modules/roles/entities/role.entity';
import { Permission } from '../../modules/permissions/entities/permission.entity';
import { User } from '../../modules/users/entities/user.entity';

export const DatabaseProvider = TypeOrmModule.forRootAsync({
  imports: [ConfigModule],

  useFactory: async () => {
    const config = databaseConfig[process.env.NODE_ENV];

    return {
      ...config,
      entities: [Country, Role, Permission, User],
      migrationsTableName: 'migrations',
      namingStrategy: new SnakeNamingStrategy(),
      propertyNamingStrategy: 'snake_case',
    };
  },

  inject: [ConfigService],
});
