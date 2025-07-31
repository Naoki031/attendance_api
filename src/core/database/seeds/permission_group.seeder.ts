import { DataSource } from 'typeorm';
import { Seeder, SeederFactoryManager } from 'typeorm-extension';
import { PermissionGroup } from '../../../modules/permission_groups/entities/permission_group.entity';

export default class PermissionGroupSeeder implements Seeder {
  public async run(
    dataSource: DataSource,
    factoryManager: SeederFactoryManager,
  ): Promise<any> {
    const repository = dataSource.getRepository(PermissionGroup);

    await repository.insert([
      {
        name: 'Super',
        permissions: JSON.stringify(['all_privileges']),
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        name: 'Admin',
        permissions: JSON.stringify(['create', 'update', 'delete']),
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        name: 'User',
        permissions: JSON.stringify(['create', 'update']),
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
  }
}
