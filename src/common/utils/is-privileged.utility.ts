/**
 * Checks whether the given roles include an admin-level privilege.
 * Normalises role names by lowercasing and stripping spaces/underscores
 * so that "Super Admin", "super_admin", and "superadmin" all match.
 */
export function isPrivilegedUser(roles: string[] = []): boolean {
  const normalized = roles.map((role) => role.toLowerCase().replace(/[\s_]+/g, ''))

  return normalized.some((role) => role === 'admin' || role === 'superadmin' || role === 'super')
}

/**
 * Checks whether the given roles include super-admin privilege only.
 * Used for sensitive operations like kiosk face check-in where regular
 * admins should NOT be allowed to clock in on behalf of others.
 */
export function isSuperAdmin(roles: string[] = []): boolean {
  const normalized = roles.map((role) => role.toLowerCase().replace(/[\s_]+/g, ''))

  return normalized.some((role) => role === 'superadmin' || role === 'super')
}
