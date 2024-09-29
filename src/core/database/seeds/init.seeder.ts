import { DataSource } from 'typeorm';
import { runSeeders, Seeder, SeederFactoryManager } from 'typeorm-extension';
import CountrySeeder from './country.seeder';
import RoleSeeder from './role.seeder';
import PermissionSeeder from './permission.seeder';
import AdminSeeder from './admin.seeder';
import PermissionGroupSeeder from './permission_group.seeder';
import UserGroupPermissionSeeder from './user_group_permission.seeder';
export default class InitSeeder implements Seeder {
  public async run(
    dataSource: DataSource,
    factoryManager: SeederFactoryManager,
  ): Promise<any> {
    await runSeeders(dataSource, {
      seeds: [
        CountrySeeder,
        RoleSeeder,
        PermissionSeeder,
        AdminSeeder,
        PermissionGroupSeeder,
        UserGroupPermissionSeeder,
      ],
    });
  }
}
