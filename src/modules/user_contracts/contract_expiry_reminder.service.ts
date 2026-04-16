import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Cron } from '@nestjs/schedule'
import * as moment from 'moment-timezone'
import { User } from '@/modules/users/entities/user.entity'
import { UserDepartment } from '@/modules/user_departments/entities/user_department.entity'
import { MailService } from '@/modules/mail/mail.service'
import { EventsGateway } from '@/modules/events/events.gateway'
import { ErrorLogsService } from '@/modules/error_logs/error_logs.service'
import { ConfigService } from '@nestjs/config'

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
    @InjectRepository(UserDepartment)
    private readonly userDepartmentRepository: Repository<UserDepartment>,
    private readonly mailService: MailService,
    private readonly eventsGateway: EventsGateway,
    private readonly errorLogsService: ErrorLogsService,
    private readonly configService: ConfigService,
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
   * Finds all employees with contracts expiring within their reminder window
   * and sends notifications to company admins.
   */
  private async checkExpiringContracts(): Promise<void> {
    const today = moment.utc().format('YYYY-MM-DD')

    // Query employees whose current contract is about to expire and haven't been notified today
    const expiringUsers = await this.userRepository
      .createQueryBuilder('user')
      .where('user.is_activated = :activated', { activated: true })
      .andWhere('user.contract_expired_date IS NOT NULL')
      .andWhere('user.contract_expired_date >= :today', { today })
      .andWhere(
        'DATEDIFF(user.contract_expired_date, :today) <= user.contract_expiry_reminder_days',
        { today },
      )
      .andWhere(
        '(user.contract_reminder_last_sent_at IS NULL OR user.contract_reminder_last_sent_at < :today)',
        { today },
      )
      .select([
        'user.id',
        'user.first_name',
        'user.last_name',
        'user.contract_type',
        'user.contract_expired_date',
        'user.contract_expiry_reminder_days',
      ])
      .getMany()

    if (!expiringUsers.length) return

    this.logger.log(`Found ${expiringUsers.length} employee(s) with expiring contracts`)

    for (const employee of expiringUsers) {
      try {
        await this.notifyForEmployee(employee, today)
      } catch (error) {
        this.logger.error(
          `Failed to send reminder for employee ${employee.id}: ${(error as Error).message}`,
        )
      }
    }
  }

  /**
   * Sends email and WebSocket notification to company admins for a single employee.
   * Notifies admins in ALL companies the employee belongs to.
   * Updates contract_reminder_last_sent_at to today after sending.
   */
  private async notifyForEmployee(employee: User, today: string): Promise<void> {
    // Get all companies the employee belongs to
    const departments = await this.userDepartmentRepository.find({
      where: { user_id: employee.id },
    })
    if (!departments.length) return

    const expiredDate = employee.contract_expired_date ?? ''
    const daysRemaining = moment.utc(expiredDate).diff(moment.utc(today), 'days')
    const employeeName = [employee.first_name, employee.last_name].filter(Boolean).join(' ')
    const contractTypeLabel = this.getContractTypeLabel(employee.contract_type ?? '')
    const clientUrl = this.configService.get<string>('CLIENT_URL', 'http://localhost')
    const profileUrl = `${clientUrl}/management/users/${employee.id}`

    // Notify admins in each company the employee belongs to
    for (const department of departments) {
      const companyId = department.company_id

      // Find admin users in this company (role = 'admin', NOT super_admin)
      const admins = await this.userRepository
        .createQueryBuilder('user')
        .innerJoin('user.user_departments', 'ud', 'ud.company_id = :companyId', { companyId })
        .innerJoin('user.user_group_permissions', 'ugp')
        .innerJoin('ugp.permission_group', 'pg', "pg.name = 'admin'")
        .where('user.is_activated = :activated', { activated: true })
        .select(['user.id', 'user.email', 'user.first_name', 'user.last_name'])
        .getMany()

      if (!admins.length) {
        this.logger.warn(
          `No admin found for company ${companyId} — skipping reminder for employee ${employee.id}`,
        )
        continue
      }

      // Send email to each admin
      for (const admin of admins) {
        const adminName = [admin.first_name, admin.last_name].filter(Boolean).join(' ')
        await this.mailService.sendTemplate('contract_expiry_reminder', admin.email, {
          admin_name: adminName,
          employee_name: employeeName,
          contract_type: contractTypeLabel,
          expired_date: expiredDate,
          days_remaining: String(daysRemaining),
          profile_url: profileUrl,
        })
      }

      // Emit WebSocket event to all clients in the company room (admins filter client-side)
      this.eventsGateway.server.to(`company:${companyId}`).emit('contract:expiry_reminder', {
        userId: employee.id,
        employeeName,
        contractType: employee.contract_type,
        expiredDate,
        daysRemaining,
      })

      this.logger.log(
        `Contract expiry reminder sent for employee ${employee.id} (${employeeName}), company ${companyId}, expires in ${daysRemaining} day(s)`,
      )
    }

    // Mark reminder as sent today so we don't send again (regardless of how many companies)
    await this.userRepository.update({ id: employee.id }, { contract_reminder_last_sent_at: today })
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
