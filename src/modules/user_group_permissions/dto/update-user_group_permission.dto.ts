import { PartialType } from '@nestjs/mapped-types';
import { CreateUserGroupPermissionDto } from './create-user_group_permission.dto';

export class UpdateUserGroupPermissionDto extends PartialType(CreateUserGroupPermissionDto) {}
