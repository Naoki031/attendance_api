import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Cron } from '@nestjs/schedule'
import moment from 'moment-timezone'
import { User } from '@/modules/users/entities/user.entity'
import { UserContract } from './entities/user_contract.entity'
import { UserDepartment } from '@/modules/user_departments/entities/user_department.entity'
import { MailService } from '@/modules/mail/mail.service'
import { EventsGateway } from '@/modules/events/events.gateway'
import { ErrorLogsService } from '@/modules/error_logs/error_logs.service'
import { ConfigService } from '@nestjs/config'
import { NotificationsService } from '@/modules/notifications/notifications.service'
import {
  MANAGEMENT_DEPT_NAMES,
  getManagementCompanyIds,
} from '@/common/utils/department-management.utility'

interface ExpiringContractInfo {
  userId: number
  firstName: string | null
  lastName: string | null
  contractType: string
  expiredDate: string
}

/**
 * Runs a daily cron job at 08:00 to send contract expiry reminder notifications
 * to company admins when an employee's contract is about to expire.
 */
@Injectable()
export class ContractExpiryReminderService {
  private readonly logger = new Logger(ContractExpiryReminderService.name)
  private isRunning = false

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserContract)
    private readonly userContractRepository: Repository<UserContract>,
    @InjectRepository(UserDepartment)
    private readonly userDepartmentRepository: Repository<UserDepartment>,
    private readonly mailService: MailService,
    private readonly eventsGateway: EventsGateway,
    private readonly errorLogsService: ErrorLogsService,
    private readonly configService: ConfigService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Runs at 08:00 every day. Finds employees whose contract expires within their
   * reminder window and notifies company admins via email and WebSocket.
   */
  @Cron('0 8 * * *')
  async handleContractExpiryReminders(): Promise<void> {
    if (this.isRunning) return
    this.isRunning = true

    try {
      await this.checkExpiringContracts()
    } catch (error) {
      this.logger.error('Contract expiry reminder cron failed', error)
      this.errorLogsService.logError({
        message: 'Contract expiry reminder cron failed',
        stackTrace: (error as Error).stack ?? null,
        path: 'contract-expiry-reminder',
      })
    } finally {
      this.isRunning = false
    }
  }

  /**
   * Finds employees whose latest contract (highest contract_number) is expiring
   * within their reminder window and haven't been notified today.
   * Indefinite contracts (expired_date IS NULL) are always skipped.
   */
  private async checkExpiringContracts(): Promise<void> {
    const today = moment.utc().format('YYYY-MM-DD')

    const rows = await this.userContractRepository
      .createQueryBuilder('uc')
      .innerJoin('uc.user', 'user')
      .select('uc.user_id', 'userId')
      .addSelect('uc.contract_type', 'contractType')
      .addSelect('uc.expired_date', 'expiredDate')
      .addSelect('user.first_name', 'firstName')
      .addSelect('user.last_name', 'lastName')
      .where('user.is_activated = :activated', { activated: true })
      .andWhere('uc.expired_date IS NOT NULL')
      .andWhere('uc.expired_date >= :today', { today })
      .andWhere(
        'DATEDIFF(uc.expired_date, :today) <= COALESCE(user.contract_expiry_reminder_days, 30)',
        { today },
      )
      // Only the latest contract per user
      .andWhere(
        'uc.contract_number = (SELECT MAX(uc2.contract_number) FROM user_contracts uc2 WHERE uc2.user_id = uc.user_id)',
      )
      .andWhere(
        '(user.contract_reminder_last_sent_at IS NULL OR user.contract_reminder_last_sent_at < :today)',
        { today },
      )
      .getRawMany<ExpiringContractInfo>()

    if (!rows.length) return

    this.logger.log(`Found ${rows.length} employee(s) with expiring contracts`)

    for (const info of rows) {
      try {
        await this.notifyForEmployee(info, today)
      } catch (error) {
        this.logger.error(
          `Failed to send reminder for employee ${info.userId}: ${(error as Error).message}`,
        )
      }
    }
  }

  /**
   * Sends email and WebSocket notification to company admins for a single employee.
   * Notifies admins in ALL companies the employee belongs to.
   * Updates contract_reminder_last_sent_at to today after sending.
   */
  private async notifyForEmployee(info: ExpiringContractInfo, today: string): Promise<void> {
    // Get all companies the employee belongs to (deduplicated by company_id)
    const departments = await this.userDepartmentRepository.find({
      where: { user_id: info.userId },
    })
    if (!departments.length) return

    const uniqueCompanyIds = [...new Set(departments.map((department) => department.company_id))]

    const expiredDate = info.expiredDate
    const daysRemaining = moment.utc(expiredDate).diff(moment.utc(today), 'days')
    const employeeName = [info.firstName, info.lastName].filter(Boolean).join(' ')
    const contractTypeLabel = this.getContractTypeLabel(info.contractType)
    const clientUrl = this.configService.get<string>('CLIENT_URL', 'http://localhost')
    const profileUrl = `${clientUrl}/management/users/${info.userId}`

    // Notify admins in each company the employee belongs to (one pass per unique company)
    for (const companyId of uniqueCompanyIds) {
      // Find users in Admin or Manager departments of this company,
      // excluding anyone who has at least one permission group with all_privileges.
      // Uses NOT EXISTS to correctly exclude super admins who may have multiple permission groups.
      const recipients = await this.userRepository
        .createQueryBuilder('user')
        .innerJoin('user.user_departments', 'ud', 'ud.company_id = :companyId', { companyId })
        .innerJoin('ud.department', 'dept')
        .where('user.is_activated = :activated', { activated: true })
        .andWhere('LOWER(dept.name) IN (:...deptNames)', { deptNames: MANAGEMENT_DEPT_NAMES })
        .andWhere(
          `NOT EXISTS (
            SELECT 1 FROM user_group_permissions ugp_check
            INNER JOIN permission_groups pg_check ON ugp_check.permission_group_id = pg_check.id
            WHERE ugp_check.user_id = user.id
            AND JSON_CONTAINS(pg_check.permissions, '"all_privileges"')
          )`,
        )
        .select(['user.id', 'user.email', 'user.first_name', 'user.last_name'])
        .distinct(true)
        .getMany()

      if (!recipients.length) {
        this.logger.warn(
          `No admin found for company ${companyId} — skipping reminder for employee ${info.userId}`,
        )
        continue
      }

      // Send email + create DB notification + emit to each recipient's user room
      for (const admin of recipients) {
        const adminName = [admin.first_name, admin.last_name].filter(Boolean).join(' ')
        await this.mailService.sendTemplate('contract_expiry_reminder', admin.email, {
          admin_name: adminName,
          employee_name: employeeName,
          contract_type: contractTypeLabel,
          expired_date: expiredDate,
          days_remaining: String(daysRemaining),
          profile_url: profileUrl,
        })

        // Persist notification to DB
        const notification = await this.notificationsService.create({
          userId: admin.id,
          type: 'contract_expiry_reminder',
          title: `Contract expiry: ${employeeName}`,
          body: `Expires in ${daysRemaining} day(s) on ${expiredDate}`,
          icon: 'mdi-file-alert-outline',
          iconColor: 'warning',
          route: `/management/users/${info.userId}`,
          data: {
            userId: info.userId,
            employeeName,
            contractType: info.contractType,
            expiredDate,
            daysRemaining,
          },
        })

        // Emit to the admin's personal socket room for real-time badge update
        this.eventsGateway.server.to(`user:${admin.id}`).emit('notification:new', notification)
      }

      this.logger.log(
        `Contract expiry reminder sent for employee ${info.userId} (${employeeName}), company ${companyId}, expires in ${daysRemaining} day(s)`,
      )
    }

    // Mark reminder as sent today so we don't send again (regardless of how many companies)
    await this.userRepository.update({ id: info.userId }, { contract_reminder_last_sent_at: today })
  }

  /**
   * Returns pending contract expiry reminders for the given user's companies.
   * Reads from the latest contract in user_contracts (not the denormalized users fields).
   * Used by the client to re-show notifications after a page reload.
   */
  async getPendingReminders(userId: number): Promise<
    Array<{
      userId: number
      employeeName: string
      contractType: string
      expiredDate: string
      daysRemaining: number
    }>
  > {
    const today = moment.utc().format('YYYY-MM-DD')

    // Find which companies this admin/manager belongs to
    const companyIds = await getManagementCompanyIds(this.userDepartmentRepository, userId)
    if (!companyIds.length) return []

    // Find employees whose reminders were sent today in the same companies,
    // joining user_contracts to get the actual latest contract info.
    const rows = await this.userContractRepository
      .createQueryBuilder('uc')
      .innerJoin('uc.user', 'user')
      .innerJoin('user.user_departments', 'ud', 'ud.company_id IN (:...companyIds)', { companyIds })
      .select('uc.user_id', 'userId')
      .addSelect('uc.contract_type', 'contractType')
      .addSelect('uc.expired_date', 'expiredDate')
      .addSelect('user.first_name', 'firstName')
      .addSelect('user.last_name', 'lastName')
      .where('user.is_activated = :activated', { activated: true })
      .andWhere('uc.expired_date IS NOT NULL')
      .andWhere('uc.expired_date >= :today', { today })
      .andWhere('user.contract_reminder_last_sent_at = :today', { today })
      // Only the latest contract per user
      .andWhere(
        'uc.contract_number = (SELECT MAX(uc2.contract_number) FROM user_contracts uc2 WHERE uc2.user_id = uc.user_id)',
      )
      .distinct(true)
      .getRawMany<{
        userId: number
        contractType: string
        expiredDate: string
        firstName: string | null
        lastName: string | null
      }>()

    return rows.map((row) => {
      const daysRemaining = moment.utc(row.expiredDate).diff(moment.utc(today), 'days')
      const employeeName = [row.firstName, row.lastName].filter(Boolean).join(' ')
      return {
        userId: row.userId,
        employeeName,
        contractType: row.contractType,
        expiredDate: row.expiredDate,
        daysRemaining,
      }
    })
  }

  /**
   * Returns a human-readable label for the contract type.
   */
  private getContractTypeLabel(contractType: string): string {
    if (contractType === 'probation') return 'Probation'
    if (contractType === 'fixed_term') return 'Fixed Term'
    if (contractType === 'indefinite') return 'Indefinite'
    return contractType
  }
}
