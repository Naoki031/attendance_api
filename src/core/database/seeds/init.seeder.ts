import { DataSource } from 'typeorm'
import { runSeeders, Seeder, SeederFactoryManager } from 'typeorm-extension'
import CountrySeeder from './country.seeder'
import RoleSeeder from './role.seeder'
import PermissionSeeder from './permission.seeder'
import AdminSeeder from './admin.seeder'
import PermissionGroupSeeder from './permission_group.seeder'
import UserGroupPermissionSeeder from './user_group_permission.seeder'
import ExampleUsersSeeder from './example_users.seeder'
import EmailTemplateSeeder from './email_template.seeder'

export default class InitSeeder implements Seeder {
  public async run(dataSource: DataSource, _factoryManager: SeederFactoryManager): Promise<void> {
    await runSeeders(dataSource, {
      seeds: [
        CountrySeeder,
        RoleSeeder,
        PermissionSeeder,
        AdminSeeder,
        PermissionGroupSeeder,
        UserGroupPermissionSeeder,
        ExampleUsersSeeder,
        EmailTemplateSeeder,
      ],
    })
  }
}
