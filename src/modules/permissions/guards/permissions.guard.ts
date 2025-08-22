import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserGroupPermissionsService } from '@/modules/user_group_permissions/user_group_permissions.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private readonly userGroupPermissionsService: UserGroupPermissionsService,
  ) {
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>('permissions', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!request.user || !request.user.id) {
      throw new ForbiddenException('User not authenticated or no permissions found');
    }

    const userWithPermissions = await this.userGroupPermissionsService.getUserPermissions(user.id);
    const permissionKeys = userWithPermissions
      .flatMap(userGroupPermission => userGroupPermission.permission_group?.permissions || [])
      .filter(Boolean);
    const hasPermission =
      permissionKeys.includes('all_privileges') ||
      requiredPermissions.some((permission) => permissionKeys.includes(permission));

    if (!hasPermission) {
      throw new ForbiddenException('You do not have permission');
    }

    return true;
  }
}