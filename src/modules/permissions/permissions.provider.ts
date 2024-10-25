import { Permission } from './entities/permission.entity';
import { PERMISSION_REPOSITORY } from 'src/core/constants/repository';

export const permissionsProviders = [
  {
    provide: PERMISSION_REPOSITORY,
    useValue: Permission,
  },
];
