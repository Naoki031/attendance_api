import { DataSource } from 'typeorm';
import { Seeder, SeederFactoryManager } from 'typeorm-extension';
import { Permission } from '../../../modules/permissions/entities/permission.entity';

export default class PermissionSeeder implements Seeder {
  public async run(
    dataSource: DataSource,
    factoryManager: SeederFactoryManager,
  ): Promise<any> {
    const repository = dataSource.getRepository(Permission);

    await repository.insert([
      {
        name: 'ALL PRIVILEGES',
        key: 'all_privileges',
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        name: 'CREATE',
        key: 'create',
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        name: 'UPDATE',
        key: 'update',
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        name: 'DELETE',
        key: 'delete',
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        name: 'GRANT OPTION',
        key: 'grant_option',
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
  }
}
