import { DataSource, DataSourceOptions } from 'typeorm'
import { SnakeNamingStrategy } from 'typeorm-naming-strategies'
import { SeederOptions } from 'typeorm-extension'
import { Country } from '../../modules/countries/entities/country.entity'
import { City } from '../../modules/cities/entities/city.entity'
import { Company } from '../../modules/companies/entities/company.entity'
import { Role } from '../../modules/roles/entities/role.entity'
import { Permission } from '../../modules/permissions/entities/permission.entity'
import { User } from '../../modules/users/entities/user.entity'
import { PermissionGroup } from '../../modules/permission_groups/entities/permission_group.entity'
import { UserGroupPermission } from '../../modules/user_group_permissions/entities/user_group_permission.entity'
import { databaseConfig } from './database.config'
import InitSeeder from './seeds/init.seeder'

const config = databaseConfig[process.env.NODE_ENV]

const options: DataSourceOptions & SeederOptions = {
  ...config,
  entities: [Country, City, Company, Role, Permission, User, PermissionGroup, UserGroupPermission],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  migrationsTableName: 'migrations',
  seeds: [InitSeeder],
  synchronize: false, // Always set this to false in production
  namingStrategy: new SnakeNamingStrategy(),
}

export const AppDataSource = new DataSource(options)
