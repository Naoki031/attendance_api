import { hash } from 'bcrypt'
import { DataSource } from 'typeorm'
import { Seeder, SeederFactoryManager } from 'typeorm-extension'
import { User } from '../../../modules/users/entities/user.entity'

export default class ExampleUsersSeeder implements Seeder {
  public async run(dataSource: DataSource, _factoryManager: SeederFactoryManager): Promise<void> {
    const repository = dataSource.getRepository(User)
    const passwordHash = await hash('password', 10)

    const users: Partial<User>[] = [
      {
        id: 1,
        username: 'kingvi',
        first_name: 'Test',
        last_name: 'Admin',
        email: 'example1@gmail.com',
        device_user_id: null,
        password: passwordHash,
        is_activated: true,
      },
      {
        id: 2,
        username: 'trucnguyen.remvn031',
        first_name: 'Nguyễn',
        last_name: 'Trực',
        email: 'example2@gmail.com',
        device_user_id: 40,
        password: passwordHash,
        is_activated: true,
      },
      {
        id: 6,
        username: 'dangtuyen.remvn004',
        first_name: 'Đặng',
        last_name: 'Tuyền',
        email: 'example3@gmail.com',
        device_user_id: 7,
        password: passwordHash,
        is_activated: true,
      },
      {
        id: 7,
        username: 'nguyentri.remvn007',
        first_name: 'Nguyễn',
        last_name: 'Trí',
        email: 'example4@gmail.com',
        device_user_id: 11,
        password: passwordHash,
        is_activated: true,
      },
      {
        id: 8,
        username: 'longho.remvn028',
        first_name: 'Hồ',
        last_name: 'Long',
        email: 'example5@gmail.com',
        device_user_id: 37,
        password: passwordHash,
        is_activated: true,
      },
      {
        id: 9,
        username: 'tungnguyen.remvn008',
        first_name: 'Nguyễn',
        last_name: 'Tung',
        email: 'example6@gmail.com',
        device_user_id: 12,
        password: passwordHash,
        is_activated: true,
      },
      {
        id: 10,
        username: 'nguyenanh.remvn027',
        first_name: 'Nguyễn',
        last_name: 'Anh',
        email: 'example7@gmail.com',
        device_user_id: 36,
        password: passwordHash,
        is_activated: true,
      },
      {
        id: 11,
        username: 'phuocnguyen.remvn030',
        first_name: 'Nguyễn',
        last_name: 'Phước',
        email: 'example8@gmail.com',
        device_user_id: 39,
        password: passwordHash,
        is_activated: true,
      },
      {
        id: 12,
        username: 'aishinzato.remvn045',
        first_name: 'Ai',
        last_name: 'Shinzato',
        email: 'example9@gmail.com',
        device_user_id: 45,
        password: passwordHash,
        is_activated: true,
      },
      {
        id: 13,
        username: 'phuongnguyen.remvn036',
        first_name: 'Nguyễn',
        last_name: 'Phương',
        email: 'example10@gmail.com',
        device_user_id: 47,
        password: passwordHash,
        is_activated: true,
      },
      {
        id: 14,
        username: 'tunguyen.remvn040',
        first_name: 'Nguyễn',
        last_name: 'Tú',
        email: 'example11@gmail.com',
        device_user_id: 51,
        password: passwordHash,
        is_activated: true,
      },
      {
        id: 15,
        username: 'phongvo.remvn041',
        first_name: 'Võ',
        last_name: 'Phong',
        email: 'example12@gmail.com',
        device_user_id: 52,
        password: passwordHash,
        is_activated: true,
      },
      {
        id: 16,
        username: 'haonguyen.remvn042',
        first_name: 'Nguyễn',
        last_name: 'Hào',
        email: 'example13@gmail.com',
        device_user_id: 53,
        password: passwordHash,
        is_activated: true,
      },
      {
        id: 17,
        username: 'dungle.remvn002',
        first_name: 'Lê',
        last_name: 'Dũng',
        email: 'example14@gmail.com',
        device_user_id: 20,
        password: passwordHash,
        is_activated: true,
      },
    ]

    for (const userData of users) {
      const existing = await repository.findOne({ where: { id: userData.id } })

      if (existing) {
        await repository.update({ id: userData.id }, userData)
      } else {
        await repository.save(userData)
      }
    }
  }
}
