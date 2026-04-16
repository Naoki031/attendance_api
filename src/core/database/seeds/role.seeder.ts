import { DataSource } from 'typeorm'
import { Seeder, SeederFactoryManager } from 'typeorm-extension'
import { Role } from '../../../modules/roles/entities/role.entity'

const roles: Partial<Role>[] = [
  { name: 'Super Admin', key: 'super_admin' },
  { name: 'Admin', key: 'admin' },
  { name: 'User', key: 'user' },
]

export default class RoleSeeder implements Seeder {
  public async run(dataSource: DataSource, _factoryManager: SeederFactoryManager): Promise<void> {
    const repository = dataSource.getRepository(Role)

    for (const roleData of roles) {
      const existing = await repository.findOne({ where: { key: roleData.key } })
      if (!existing) {
        await repository.save(repository.create(roleData))
      }
    }
  }
}
