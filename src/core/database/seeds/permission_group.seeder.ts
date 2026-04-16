import { DataSource } from 'typeorm'
import { Seeder, SeederFactoryManager } from 'typeorm-extension'
import { PermissionGroup } from '../../../modules/permission_groups/entities/permission_group.entity'

const permissionGroups: Partial<PermissionGroup>[] = [
  { name: 'Super', permissions: JSON.stringify(['all_privileges']) },
  { name: 'Admin', permissions: JSON.stringify(['read', 'create', 'update', 'delete']) },
  { name: 'User', permissions: JSON.stringify(['create', 'update']) },
]

export default class PermissionGroupSeeder implements Seeder {
  public async run(dataSource: DataSource, _factoryManager: SeederFactoryManager): Promise<void> {
    const repository = dataSource.getRepository(PermissionGroup)

    for (const groupData of permissionGroups) {
      const existing = await repository.findOne({ where: { name: groupData.name } })
      if (!existing) {
        await repository.save(repository.create(groupData))
      }
    }
  }
}
