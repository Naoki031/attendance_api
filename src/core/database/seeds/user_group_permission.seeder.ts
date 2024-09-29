import { DataSource } from 'typeorm';
import { Seeder, SeederFactoryManager } from 'typeorm-extension';
import { UserGroupPermission } from '../../../modules/user_group_permissions/entities/user_group_permission.entity';

export default class UserGroupPermissionSeeder implements Seeder {
  public async run(
    dataSource: DataSource,
    factoryManager: SeederFactoryManager,
  ): Promise<any> {
    const repository = dataSource.getRepository(UserGroupPermission);

    await repository.insert([
      {
        user_id: 1,
        permission_group_id: 1,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
  }
}
