import { Test, TestingModule } from '@nestjs/testing';
import { UserGroupPermissionsService } from './user_group_permissions.service';

describe('UserGroupPermissionsService', () => {
  let service: UserGroupPermissionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UserGroupPermissionsService],
    }).compile();

    service = module.get<UserGroupPermissionsService>(UserGroupPermissionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
