import { DataSource } from 'typeorm'
import { Seeder, SeederFactoryManager } from 'typeorm-extension'
import { Permission } from '../../../modules/permissions/entities/permission.entity'

const permissions: Partial<Permission>[] = [
  { name: 'ALL PRIVILEGES', key: 'all_privileges' },
  { name: 'CREATE', key: 'create' },
  { name: 'UPDATE', key: 'update' },
  { name: 'DELETE', key: 'delete' },
  { name: 'GRANT OPTION', key: 'grant_option' },
]

export default class PermissionSeeder implements Seeder {
  public async run(dataSource: DataSource, _factoryManager: SeederFactoryManager): Promise<void> {
    const repository = dataSource.getRepository(Permission)

    for (const permissionData of permissions) {
      const existing = await repository.findOne({ where: { key: permissionData.key } })
      if (!existing) {
        await repository.save(repository.create(permissionData))
      }
    }
  }
}
