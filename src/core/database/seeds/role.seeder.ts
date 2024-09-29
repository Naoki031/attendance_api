import { DataSource } from 'typeorm';
import { Seeder, SeederFactoryManager } from 'typeorm-extension';
import { Role } from '../../../modules/roles/entities/role.entity';

export default class RoleSeeder implements Seeder {
  public async run(
    dataSource: DataSource,
    factoryManager: SeederFactoryManager,
  ): Promise<any> {
    const repository = dataSource.getRepository(Role);

    await repository.insert([
      {
        name: 'Super Admin',
        key: 'super_admin',
      },
      {
        name: 'Admin',
        key: 'admin',
      },
      {
        name: 'User',
        key: 'user',
      },
    ]);
  }
}
