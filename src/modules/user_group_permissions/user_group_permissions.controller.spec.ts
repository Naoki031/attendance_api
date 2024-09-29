import { Test, TestingModule } from '@nestjs/testing';
import { UserGroupPermissionsController } from './user_group_permissions.controller';
import { UserGroupPermissionsService } from './user_group_permissions.service';

describe('UserGroupPermissionsController', () => {
  let controller: UserGroupPermissionsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserGroupPermissionsController],
      providers: [UserGroupPermissionsService],
    }).compile();

    controller = module.get<UserGroupPermissionsController>(UserGroupPermissionsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
