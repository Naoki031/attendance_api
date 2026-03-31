import { hash } from 'bcrypt'
import { DataSource } from 'typeorm'
import { Seeder, SeederFactoryManager } from 'typeorm-extension'
import { User } from '../../../modules/users/entities/user.entity'

export default class AdminSeeder implements Seeder {
  public async run(dataSource: DataSource, _factoryManager: SeederFactoryManager): Promise<void> {
    const repository = dataSource.getRepository(User)

    await repository.insert([
      {
        username: 'kingvi',
        first_name: 'Trung Truc',
        last_name: 'Nguyen',
        position: 'Leader',
        phone_number: '0909090909',
        email: 'admin@example.com',
        address: 'HCMC',
        password: await hash('password', 10),
        is_activated: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ])
  }
}
