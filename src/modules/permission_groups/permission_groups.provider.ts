import { PermissionGroup } from './entities/permission_group.entity';
import { PERMISSION_GROUP_REPOSITORY } from 'src/core/constants/repository';

export const permissionGroupsProviders = [
  {
    provide: PERMISSION_GROUP_REPOSITORY,
    useValue: PermissionGroup,
  },
];
