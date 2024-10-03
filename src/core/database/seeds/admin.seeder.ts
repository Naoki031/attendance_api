import { hash } from 'bcrypt';
import { DataSource } from 'typeorm';
import { Seeder, SeederFactoryManager } from 'typeorm-extension';
import { User } from '../../../modules/users/entities/user.entity';

export default class AdminSeeder implements Seeder {
  public async run(
    dataSource: DataSource,
    factoryManager: SeederFactoryManager,
  ): Promise<any> {
    const repository = dataSource.getRepository(User);

    await repository.insert([
      {
        username: 'kingvi',
        first_name: 'Trung Truc',
        last_name: 'Nguyen',
        position: 'Leader',
        phone_number: '0909090909',
        email: 'trucnguyen.dofuu@gmail.com',
        address: 'HCMC',
        password: await hash('admin123', 10),
        is_activated: true,
        roles: '["super_admin", "user"]',
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
  }
}
