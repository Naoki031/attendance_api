/**
 * Checks whether a user holds an elevated (admin / super admin / super) role.
 * Used by controllers and services to gate management actions.
 */
export function isPrivilegedUser(roles: string[] = []): boolean {
  const normalized = roles.map((role) => role.toLowerCase().replace(/[\s_]+/g, ''))
  return normalized.some((role) => role === 'admin' || role === 'superadmin' || role === 'super')
}
