import { Repository } from 'typeorm'
import { UserDepartment } from '@/modules/user_departments/entities/user_department.entity'

/** Department names that are considered management roles. */
export const MANAGEMENT_DEPT_NAMES = ['admin', 'manager'] as const

/**
 * Returns all unique company IDs where the given user belongs to a management department
 * (Admin or Manager). Used to scope contract reminders, approvals, and similar features.
 */
export async function getManagementCompanyIds(
  userDepartmentRepository: Repository<UserDepartment>,
  userId: number,
): Promise<number[]> {
  const departments = await userDepartmentRepository
    .createQueryBuilder('ud')
    .innerJoin('ud.department', 'dept')
    .where('ud.user_id = :userId', { userId })
    .andWhere('LOWER(dept.name) IN (:...names)', { names: MANAGEMENT_DEPT_NAMES })
    .select(['ud.company_id'])
    .getMany()

  return [...new Set(departments.map((ud) => ud.company_id))]
}

/**
 * Returns true if the user belongs to a management department in at least one company.
 */
export async function isManagementUser(
  userDepartmentRepository: Repository<UserDepartment>,
  userId: number,
): Promise<boolean> {
  const count = await userDepartmentRepository
    .createQueryBuilder('ud')
    .innerJoin('ud.department', 'dept')
    .where('ud.user_id = :userId', { userId })
    .andWhere('LOWER(dept.name) IN (:...names)', { names: MANAGEMENT_DEPT_NAMES })
    .getCount()

  return count > 0
}
