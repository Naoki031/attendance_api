import { User } from './entities/user.entity';
import { USER_REPOSITORY } from 'src/core/constants/repository';

export const usersProviders = [
  {
    provide: USER_REPOSITORY,
    useValue: User,
  },
];
