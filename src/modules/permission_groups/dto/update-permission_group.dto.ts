import { PartialType } from '@nestjs/mapped-types';
import { CreatePermissionGroupDto } from './create-permission_group.dto';

export class UpdatePermissionGroupDto extends PartialType(CreatePermissionGroupDto) {}
