import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { UserGroupPermissionsService } from '@/modules/user_group_permissions/user_group_permissions.service'
import { PERMISSIONS_KEY } from '@/modules/permissions/decorators/permissions.decorator'

@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name)

  constructor(
    private reflector: Reflector,
    private readonly userGroupPermissionsService: UserGroupPermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true
    }

    const request = context.switchToHttp().getRequest()
    const user = request.user

    if (!request.user || !request.user.id) {
      throw new ForbiddenException('User not authenticated or no permissions found')
    }

    const userWithPermissions = await this.userGroupPermissionsService.getUserPermissions(user.id)
    const permissionKeys = userWithPermissions
      .flatMap((userGroupPermission) => userGroupPermission.permission_group?.permissions || [])
      .filter(Boolean)
    const hasPermission =
      permissionKeys.includes('all_privileges') ||
      requiredPermissions.some((permission) => permissionKeys.includes(permission))

    if (!hasPermission) {
      const method = request.method as string
      const url = request.url as string
      this.logger.warn(
        `[403] userId=${user.id} lacks permission for ${method} ${url} — ` +
          `required: [${requiredPermissions.join(', ')}], ` +
          `granted: [${permissionKeys.join(', ') || 'none'}]`,
      )
      throw new ForbiddenException('You do not have permission')
    }

    return true
  }
}
