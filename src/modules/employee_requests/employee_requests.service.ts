import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import { FilterEmployeeRequestDto } from './dto/filter-employee_request.dto'
import {
  EmployeeRequest,
  EmployeeRequestStatus,
  EmployeeRequestType,
  LeaveType,
  ClockType,
  OvertimeType,
} from './entities/employee_request.entity'
import { CreateEmployeeRequestDto } from './dto/create-employee_request.dto'
import { UpdateEmployeeRequestDto } from './dto/update-employee_request.dto'
import { ApproveEmployeeRequestDto } from './dto/approve-employee_request.dto'
import { SlackChannelsService } from '@/modules/slack_channels/slack_channels.service'
import { SlackChannelFeature } from '@/modules/slack_channels/entities/slack_channel.entity'
import { User } from '@/modules/users/entities/user.entity'
import { UserDepartment } from '@/modules/user_departments/entities/user_department.entity'
import { Company } from '@/modules/companies/entities/company.entity'
import { CompanyApprover } from '@/modules/companies/entities/company_approver.entity'
import { GoogleSheetsService } from '@/modules/google_sheets/google_sheets.service'
import { GoogleCalendarService } from '@/modules/google_calendar/google_calendar.service'
import { EventsGateway } from '@/modules/events/events.gateway'
import { AttendanceLogsService } from '@/modules/attendance_logs/attendance_logs.service'

@Injectable()
export class EmployeeRequestsService {
  constructor(
    @InjectRepository(EmployeeRequest)
    private readonly employeeRequestRepository: Repository<EmployeeRequest>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserDepartment)
    private readonly userDepartmentRepository: Repository<UserDepartment>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @InjectRepository(CompanyApprover)
    private readonly companyApproverRepository: Repository<CompanyApprover>,
    private readonly slackChannelsService: SlackChannelsService,
    private readonly googleSheetsService: GoogleSheetsService,
    private readonly googleCalendarService: GoogleCalendarService,
    private readonly eventsGateway: EventsGateway,
    private readonly attendanceLogsService: AttendanceLogsService,
  ) {}

  /**
   * Returns all user IDs that share the same company as the given user.
   * Falls back to only the given user ID if no company association is found.
   */
  private async getCompanyUserIds(userId: number): Promise<number[]> {
    const userDept = await this.userDepartmentRepository.findOne({
      where: { user_id: userId },
      select: ['company_id'],
    })
    if (!userDept?.company_id) return [userId]

    const depts = await this.userDepartmentRepository.find({
      where: { company_id: userDept.company_id },
      select: ['user_id'],
    })
    return [...new Set(depts.map((department) => department.user_id))]
  }

  /**
   * Returns the company ID for the given user, or null if not associated with a company.
   */
  private async getCompanyId(userId: number): Promise<number | null> {
    const userDept = await this.userDepartmentRepository.findOne({
      where: { user_id: userId },
      select: ['company_id'],
    })
    return userDept?.company_id ?? null
  }

  /**
   * Checks whether the given user is a designated company approver
   * (exists in the company_approvers table for their company).
   */
  async isCompanyApprover(userId: number): Promise<boolean> {
    const userDept = await this.userDepartmentRepository.findOne({
      where: { user_id: userId },
      select: ['company_id'],
    })
    if (!userDept?.company_id) return false

    const count = await this.companyApproverRepository.count({
      where: { company_id: userDept.company_id, user_id: userId },
    })
    return count > 0
  }

  /**
   * Returns the Google Calendar ID configured for the company the user belongs to.
   */
  private async getCompanyCalendarId(userId: number): Promise<string | null> {
    const companyId = await this.getCompanyId(userId)
    if (!companyId) return null
    const company = await this.companyRepository.findOne({
      where: { id: companyId },
      select: ['google_calendar_id'],
    })
    return company?.google_calendar_id ?? null
  }

  /**
   * Creates a new employee request and sends a Slack notification.
   */
  async create(
    createDto: CreateEmployeeRequestDto,
    requestingUser: User,
  ): Promise<EmployeeRequest> {
    try {
      const created = await this.employeeRequestRepository.save({
        ...createDto,
        user_id: requestingUser.id,
        status: EmployeeRequestStatus.PENDING,
      })

      // Load with relations for Slack message
      const requestWithUser = await this.employeeRequestRepository.findOne({
        where: { id: created.id },
        relations: ['user'],
      })

      if (requestWithUser) {
        const feature = this.mapTypeToFeature(createDto.type)
        const channel = await this.slackChannelsService.findByFeature(feature)
        const approvers = await this.findApproversForChannel(channel?.mention_user_ids)
        const slackMessage = await this.buildSlackMessage(
          requestWithUser,
          approvers,
          channel?.message_template,
        )
        await this.slackChannelsService.sendMessage(feature, slackMessage)

        // Append row to Google Sheet and store the row index for later approval update
        {
          const companyId = await this.getCompanyId(requestingUser.id)
          if (companyId) {
            const rowIndex = await this.googleSheetsService.appendRequestRow(
              requestWithUser,
              companyId,
              requestWithUser.type,
            )
            if (rowIndex) {
              await this.employeeRequestRepository.update(
                { id: created.id },
                { sheet_row_index: rowIndex },
              )
            }
          }
        }

        // Create Google Calendar event(s) in the company's calendar
        const calendarId = await this.getCompanyCalendarId(requestingUser.id)
        if (calendarId) {
          const calendarEventId = await this.googleCalendarService.createEvents(
            requestWithUser,
            calendarId,
          )
          if (calendarEventId) {
            await this.employeeRequestRepository.update(
              { id: created.id },
              { calendar_event_id: calendarEventId },
            )
          }
        }

        // Notify all users in the same company via WebSocket
        const companyId = await this.getCompanyId(requestingUser.id)
        if (companyId) {
          this.eventsGateway.emitRequestCreated(companyId, requestWithUser)
        }
      }

      return created
    } catch (error) {
      const companyId = await this.getCompanyId(requestingUser.id)
      await this.slackChannelsService.sendError(
        `❌ **Failed to create employee request**\n*User:* ${requestingUser.full_name} (${requestingUser.email})\n*Type:* ${createDto.type}\n*Error:* ${error}`,
        companyId ?? undefined,
      )
      throw error
    }
  }

  /**
   * Retrieves all employee requests (admin view) with user/approver relations.
   * Scoped to users within the same company as the requesting user.
   * Filters are applied at the database level.
   */
  async findAll(
    requestingUserId: number,
    filterDto: FilterEmployeeRequestDto,
  ): Promise<EmployeeRequest[]> {
    const userIds = await this.getCompanyUserIds(requestingUserId)

    const queryBuilder = this.employeeRequestRepository
      .createQueryBuilder('er')
      .leftJoinAndSelect('er.user', 'user')
      .leftJoinAndSelect('er.approver', 'approver')
      .where('er.user_id IN (:...userIds)', { userIds })
      .orderBy('er.created_at', 'DESC')

    if (filterDto.status) {
      queryBuilder.andWhere('er.status = :status', { status: filterDto.status })
    }

    if (filterDto.type) {
      queryBuilder.andWhere('er.type = :type', { type: filterDto.type })
    }

    if (filterDto.month) {
      queryBuilder.andWhere(
        'MONTH(COALESCE(er.forget_date, er.from_datetime, er.created_at)) = :month',
        { month: filterDto.month },
      )
    }

    if (filterDto.year) {
      queryBuilder.andWhere(
        'YEAR(COALESCE(er.forget_date, er.from_datetime, er.created_at)) = :year',
        { year: filterDto.year },
      )
    }

    if (filterDto.search) {
      queryBuilder.andWhere(
        '(user.full_name LIKE :search OR er.type LIKE :search OR CAST(er.id AS CHAR) LIKE :search)',
        { search: `%${filterDto.search}%` },
      )
    }

    return queryBuilder.getMany()
  }

  /**
   * Retrieves all approved requests — visible to all authenticated users within the same company.
   */
  async findAllApproved(requestingUserId: number): Promise<EmployeeRequest[]> {
    const userIds = await this.getCompanyUserIds(requestingUserId)
    return this.employeeRequestRepository.find({
      where: { status: EmployeeRequestStatus.APPROVED, user_id: In(userIds) },
      relations: ['user'],
      order: { created_at: 'DESC' },
    })
  }

  /**
   * Returns the count of pending requests for the admin's company.
   * Uses SQL COUNT for accuracy instead of fetching all records.
   */
  async getPendingCount(requestingUserId: number): Promise<{ count: number }> {
    const userIds = await this.getCompanyUserIds(requestingUserId)
    const count = await this.employeeRequestRepository.count({
      where: { status: EmployeeRequestStatus.PENDING, user_id: In(userIds) },
    })
    return { count }
  }

  /**
   * Retrieves all approved AND pending requests for calendar display.
   * Accessible to all authenticated users within the same company (no admin permission required).
   */
  async findAllForCalendar(requestingUserId: number): Promise<EmployeeRequest[]> {
    const userIds = await this.getCompanyUserIds(requestingUserId)
    return this.employeeRequestRepository.find({
      where: [
        { status: EmployeeRequestStatus.APPROVED, user_id: In(userIds) },
        { status: EmployeeRequestStatus.PENDING, user_id: In(userIds) },
      ],
      relations: ['user'],
      order: { created_at: 'DESC' },
    })
  }

  /**
   * Retrieves requests belonging to a specific user.
   * Optionally filters by status.
   */
  async findByUser(userId: number, status?: EmployeeRequestStatus): Promise<EmployeeRequest[]> {
    return this.employeeRequestRepository.find({
      where: status ? { user_id: userId, status } : { user_id: userId },
      relations: ['user', 'approver'],
      order: { created_at: 'DESC' },
    })
  }

  /**
   * Retrieves a single employee request by ID.
   */
  async findOne(id: number): Promise<EmployeeRequest> {
    const item = await this.employeeRequestRepository.findOne({
      where: { id },
      relations: ['user', 'approver'],
    })
    if (!item) throw new NotFoundException('Employee request not found')

    return item
  }

  /**
   * Updates an employee request.
   * - Owner can update their own request only when it is pending.
   * - Admin / super_admin can update any request at any status.
   * If the updated request is a leave request with a linked sheet row, updates the data columns in Google Sheets.
   */
  async update(
    id: number,
    updateDto: UpdateEmployeeRequestDto,
    requestingUser: User,
  ): Promise<EmployeeRequest> {
    try {
      const request = await this.findOne(id)

      const isAdmin =
        requestingUser.roles?.includes('admin') || requestingUser.roles?.includes('super_admin')
      const isOwnerAndPending =
        request.user_id === requestingUser.id && request.status === EmployeeRequestStatus.PENDING

      if (!isAdmin && !isOwnerAndPending) {
        throw new ForbiddenException('You are not allowed to edit this request')
      }

      await this.employeeRequestRepository.update({ id }, { ...updateDto })

      const updatedRequest = await this.findOne(id)

      if (updatedRequest.sheet_row_index) {
        const companyId = await this.getCompanyId(requestingUser.id)
        if (companyId) {
          await this.googleSheetsService.updateRequestDataRow(
            updatedRequest.sheet_row_index,
            updatedRequest,
            companyId,
            updatedRequest.type,
          )
        }
      }

      return updatedRequest
    } catch (error) {
      const request = await this.findOne(id).catch(() => null)
      const companyId = request ? await this.getCompanyId(request.user_id) : null
      await this.slackChannelsService.sendError(
        `❌ **Failed to update employee request**\n*Request ID:* ${id}\n*Type:* ${request?.type ?? 'N/A'}\n*User:* ${requestingUser.full_name}\n*Error:* ${error}`,
        companyId ?? undefined,
      )
      throw error
    }
  }

  /**
   * Approves or rejects an employee request.
   */
  async approve(
    id: number,
    approveDto: ApproveEmployeeRequestDto,
    approvingUser: User,
  ): Promise<EmployeeRequest> {
    const request = await this.findOne(id)

    if (request.status !== EmployeeRequestStatus.PENDING) {
      throw new ForbiddenException('Request has already been processed')
    }

    // Only designated company approvers can approve/reject requests
    const isApprover = await this.isCompanyApprover(approvingUser.id)
    if (!isApprover) {
      throw new ForbiddenException('Only designated company approvers can approve requests')
    }

    await this.employeeRequestRepository.update(
      { id },
      {
        status: approveDto.status,
        approver_id: approvingUser.id,
        approver_note: approveDto.note,
      },
    )

    // Update Google Sheet row with approval result
    if (request.sheet_row_index) {
      const [fullApprovingUser, companyId] = await Promise.all([
        this.userRepository.findOne({ where: { id: approvingUser.id } }),
        this.getCompanyId(request.user_id),
      ])
      if (companyId) {
        await this.googleSheetsService.updateApprovalRow(
          request.sheet_row_index,
          approveDto.status,
          fullApprovingUser?.full_name ?? approvingUser.email,
          approveDto.note ?? '',
          companyId,
          request.type,
        )
      }
    }

    // If rejected, remove the calendar event(s) that were created on submission
    if (approveDto.status === EmployeeRequestStatus.REJECTED && request.calendar_event_id) {
      const calendarId = await this.getCompanyCalendarId(request.user_id)
      if (calendarId) {
        await this.googleCalendarService.deleteEvents(calendarId, request.calendar_event_id)
      }
    }

    const approvedRequest = await this.findOne(id)

    // If a CLOCK_FORGET request is approved, update the attendance log automatically
    if (
      approveDto.status === EmployeeRequestStatus.APPROVED &&
      request.type === EmployeeRequestType.CLOCK_FORGET &&
      request.clock_type &&
      request.forget_date &&
      request.from_datetime
    ) {
      const clockTime = new Date(request.from_datetime).toISOString().substring(11, 19)
      try {
        await this.attendanceLogsService.applyClockForget(
          request.user_id,
          request.forget_date,
          request.clock_type,
          clockTime,
        )
      } catch (error) {
        console.error('[CLOCK_FORGET] Failed to apply to attendance log:', error)
        await this.slackChannelsService.sendSystemError(
          `[CLOCK_FORGET] Failed to apply attendance log for request #${request.id} (user_id: ${request.user_id}, date: ${request.forget_date}): ${(error as Error).message}`,
        )
      }
    }

    // Notify all users in the same company via WebSocket
    const companyId = await this.getCompanyId(request.user_id)
    if (companyId) {
      this.eventsGateway.emitRequestUpdated(companyId, approvedRequest)
    }

    return approvedRequest
  }

  /**
   * Returns approvers for a Slack mention:
   * - If the channel has configured mention_user_ids, load those users.
   * - Otherwise fall back to all active admin / super_admin users.
   */
  private async findApproversForChannel(mentionUserIds?: number[]): Promise<User[]> {
    if (mentionUserIds?.length) {
      return this.userRepository.find({ where: { id: In(mentionUserIds) } })
    }

    return this.userRepository
      .createQueryBuilder('user')
      .innerJoin('user.user_group_permissions', 'ugp')
      .innerJoin('ugp.permission_group', 'pg')
      .where('pg.name IN (:...names)', { names: ['admin', 'super_admin'] })
      .andWhere('user.is_activated = :activated', { activated: true })
      .getMany()
  }

  /**
   * Returns a Slack mention string for a user.
   * Uses <@slack_id> if available, otherwise falls back to full name.
   */
  private slackMention(user?: User | null): string {
    if (!user) return 'Unknown'

    return user.slack_id ? `<@${user.slack_id}>` : user.full_name
  }

  /**
   * Formats a datetime for the OFF request Slack message.
   * Example: "Mar 19, 2026, 8:00:00 AM"
   */
  private formatDatetimeFull(date: Date | string | undefined): string {
    if (!date) return '—'

    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    })
  }

  /**
   * Formats a date for the Equipment/ClockForget request Slack message.
   * Example: "19/03/2026"
   */
  private formatDateShort(date: Date | string | undefined): string {
    if (!date) return '—'
    const dateObject = new Date(date)
    const day = String(dateObject.getDate()).padStart(2, '0')
    const month = String(dateObject.getMonth() + 1).padStart(2, '0')
    const year = dateObject.getFullYear()

    return `${day}/${month}/${year}`
  }

  /**
   * Returns a human-readable label for a leave type.
   */
  private leaveTypeLabel(leaveType?: LeaveType): string {
    const labels: Record<LeaveType, string> = {
      [LeaveType.PAID_LEAVE]: 'Paid Leave',
      [LeaveType.UNPAID_LEAVE]: 'Unpaid Leave',
      [LeaveType.WOMAN_LEAVE]: 'Woman Leave',
      [LeaveType.MARRIAGE_LEAVE]: 'Marriage Leave',
      [LeaveType.MATERNITY_LEAVE]: 'Maternity Leave',
      [LeaveType.PATERNITY_LEAVE]: 'Paternity Leave',
      [LeaveType.COMPASSIONATE_LEAVE]: 'Compassionate Leave',
    }

    return leaveType ? (labels[leaveType] ?? leaveType) : ''
  }

  /**
   * Wraps an array of body lines in a Slack code block (triple backticks).
   * The header lines (mentions, cc, announcement) stay outside the block.
   */
  private buildMessage(headerLines: string[], bodyLines: string[]): string {
    const header = headerLines.join('\n')
    const body = bodyLines.join('\n')

    return `${header}\n\`\`\`\n${body}\n\`\`\``
  }

  /**
   * Builds the Slack message for an OFF/leave request.
   */
  private buildOffMessage(request: EmployeeRequest, approvers: User[]): string {
    const requesterMention = this.slackMention(request.user)
    const approverMentions = approvers.map((approver) => this.slackMention(approver)).join(' ')

    const header = [
      approverMentions,
      `cc ${requesterMention}`,
      `${requesterMention} have a leave request :calendar:.`,
    ]

    const body: string[] = [
      `I would like to take a break for ${request.unit_hours ?? '—'} hours`,
      '',
      `From: ${this.formatDatetimeFull(request.from_datetime)}`,
      `To: ${this.formatDatetimeFull(request.to_datetime)}`,
    ]

    if (request.leave_type) {
      body.push(`Leave type: ${this.leaveTypeLabel(request.leave_type)}`)
    }

    if (request.reason) {
      body.push('')
      body.push(`Reason: ${request.reason}`)
    }

    body.push('')
    body.push('Sorry for inconvenience.')
    body.push('')
    body.push('Thank you!')

    return this.buildMessage(header, body)
  }

  /**
   * Builds the Slack message for an equipment borrowing request.
   */
  private buildEquipmentMessage(request: EmployeeRequest, approvers: User[]): string {
    const requesterMention = this.slackMention(request.user)
    const approverMentions = approvers.map((approver) => this.slackMention(approver)).join(' ')

    const header = [
      approverMentions,
      `cc ${requesterMention}`,
      `${requesterMention} have a Equipment borrowing request.`,
    ]

    const body: string[] = ['Please approve my equipment borrowing request.', '']

    if (request.reason) {
      body.push(`Reason: ${request.reason}`)
      body.push('')
    }

    body.push(`From: ${this.formatDateShort(request.from_datetime)}`)
    body.push(`To: ${this.formatDateShort(request.to_datetime)}`)

    if (request.location) {
      body.push('')
      body.push(`The location of using equipment: ${request.location}`)
    }

    if (request.equipment_name) {
      body.push('')
      body.push(`Equipment name: ${request.equipment_name}`)
    }

    if (request.quantity != null) {
      body.push(`Quantity: ${request.quantity}`)
    }

    body.push('')
    body.push('Thank you!')

    return this.buildMessage(header, body)
  }

  /**
   * Builds the Slack message for a WFH request.
   */
  private buildWfhMessage(request: EmployeeRequest, approvers: User[]): string {
    const requesterMention = this.slackMention(request.user)
    const approverMentions = approvers.map((approver) => this.slackMention(approver)).join(' ')

    const header = [
      approverMentions,
      `cc ${requesterMention}`,
      `${requesterMention} have a Work From Home request :house:.`,
    ]

    const body: string[] = [
      `From: ${this.formatDatetimeFull(request.from_datetime)}`,
      `To: ${this.formatDatetimeFull(request.to_datetime)}`,
    ]

    if (request.reason) {
      body.push('')
      body.push(`Reason: ${request.reason}`)
    }

    body.push('')
    body.push('Sorry for inconvenience.')
    body.push('')
    body.push('Thank you!')

    return this.buildMessage(header, body)
  }

  /**
   * Returns a human-readable label for an overtime type.
   */
  private overtimeTypeLabel(overtimeType?: OvertimeType): string {
    const labels: Record<OvertimeType, string> = {
      [OvertimeType.WEEKDAY]: 'Weekday',
      [OvertimeType.WEEKEND]: 'Weekend',
      [OvertimeType.PUBLIC_HOLIDAY]: 'Public Holiday',
    }

    return overtimeType ? (labels[overtimeType] ?? overtimeType) : ''
  }

  /**
   * Builds the Slack message for an overtime request.
   */
  private buildOvertimeMessage(request: EmployeeRequest, approvers: User[]): string {
    const requesterMention = this.slackMention(request.user)
    const approverMentions = approvers.map((approver) => this.slackMention(approver)).join(' ')

    const header = [
      approverMentions,
      `cc ${requesterMention}`,
      `${requesterMention} have a overtime request.`,
    ]

    const body: string[] = [
      'Please approve my overtime request.',
      '',
      `From: ${this.formatDatetimeFull(request.from_datetime)}`,
      `To: ${this.formatDatetimeFull(request.to_datetime)}`,
      '',
      `Total hours: ${request.unit_hours ?? '—'}`,
    ]

    if (request.reason) {
      body.push('')
      body.push(`Reason: ${request.reason}`)
    }

    body.push('')
    body.push('Thank you!')

    return this.buildMessage(header, body)
  }

  /**
   * Builds the Slack message for a clock-in/clock-out forget request.
   */
  private buildClockForgetMessage(request: EmployeeRequest, approvers: User[]): string {
    const requesterMention = this.slackMention(request.user)
    const approverMentions = approvers.map((approver) => this.slackMention(approver)).join(' ')
    const clockLabel = request.clock_type === ClockType.CLOCK_OUT ? 'Check-out' : 'Check-in'
    const forgotDate = this.formatDateShort(request.forget_date)

    const header = [
      approverMentions,
      `cc ${requesterMention}`,
      `${requesterMention} have a ${clockLabel} time request.`,
    ]

    const body = [
      `I forget to ${clockLabel} at ${forgotDate}`,
      '',
      'Please confirm it.',
      '',
      'Sorry for inconvenience.',
    ]

    return this.buildMessage(header, body)
  }

  /**
   * Replaces all {{variable}} placeholders in the template with their runtime values.
   */
  private async resolveCcUserMentions(ccUserIds?: number[]): Promise<string> {
    if (!ccUserIds?.length) return ''
    const users = await this.userRepository.find({ where: { id: In(ccUserIds) } })
    return users.map((user) => this.slackMention(user)).join(' ')
  }

  private async renderTemplate(
    template: string,
    request: EmployeeRequest,
    approvers: User[],
  ): Promise<string> {
    const clockLabel = request.clock_type === ClockType.CLOCK_OUT ? 'Check-out' : 'Check-in'
    const ccUsers = await this.resolveCcUserMentions(request.cc_user_ids)
    const variables: Record<string, string> = {
      approvers: approvers.map((approver) => this.slackMention(approver)).join(' '),
      requester: this.slackMention(request.user),
      requester_name: request.user?.full_name ?? '',
      cc_users: ccUsers,
      from_datetime: this.formatDatetimeFull(request.from_datetime),
      to_datetime: this.formatDatetimeFull(request.to_datetime),
      from_date: this.formatDateShort(request.from_datetime),
      to_date: this.formatDateShort(request.to_datetime),
      unit_hours: String(request.unit_hours ?? '—'),
      leave_type: this.leaveTypeLabel(request.leave_type),
      overtime_type: this.overtimeTypeLabel(request.overtime_type),
      clock_type: clockLabel,
      forgot_date: this.formatDateShort(request.forget_date),
      reason: request.reason ?? '',
      location: request.location ?? '',
      equipment_name: request.equipment_name ?? '',
      quantity: String(request.quantity ?? ''),
      trip_destination: request.trip_destination ?? '',
    }
    return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => variables[key] ?? '')
  }

  /**
   * Dispatches to the correct message builder based on request type.
   * Uses the slack channel's message_template if configured; otherwise falls back to hardcoded builders.
   */
  private async buildSlackMessage(
    request: EmployeeRequest,
    approvers: User[],
    template?: string,
  ): Promise<string> {
    if (template) {
      return this.renderTemplate(template, request, approvers)
    }

    switch (request.type) {
      case EmployeeRequestType.OFF:
        return this.buildOffMessage(request, approvers)
      case EmployeeRequestType.EQUIPMENT:
        return this.buildEquipmentMessage(request, approvers)
      case EmployeeRequestType.CLOCK_FORGET:
        return this.buildClockForgetMessage(request, approvers)
      case EmployeeRequestType.OVERTIME:
        return this.buildOvertimeMessage(request, approvers)
      case EmployeeRequestType.BUSINESS_TRIP:
        return this.buildBusinessTripMessage(request, approvers)
      case EmployeeRequestType.WFH:
      default:
        return this.buildWfhMessage(request, approvers)
    }
  }

  /**
   * Maps request type to slack channel feature enum.
   */
  private buildBusinessTripMessage(request: EmployeeRequest, approvers: User[]): string {
    const requesterMention = this.slackMention(request.user)
    const approverMentions = approvers.map((approver) => this.slackMention(approver)).join(' ')

    const header = [
      approverMentions,
      `cc ${requesterMention}`,
      `${requesterMention} has a business trip request.`,
    ]

    const body: string[] = [
      'Please approve my business trip request.',
      '',
      `From: ${this.formatDatetimeFull(request.from_datetime)}`,
      `To: ${this.formatDatetimeFull(request.to_datetime)}`,
      '',
      `Destination: ${request.trip_destination ?? '—'}`,
    ]

    if (request.reason) {
      body.push('')
      body.push(`Purpose: ${request.reason}`)
    }

    body.push('')
    body.push('Thank you!')

    return this.buildMessage(header, body)
  }

  private mapTypeToFeature(type: EmployeeRequestType): SlackChannelFeature {
    const map: Record<EmployeeRequestType, SlackChannelFeature> = {
      [EmployeeRequestType.WFH]: SlackChannelFeature.WFH,
      [EmployeeRequestType.OFF]: SlackChannelFeature.OFF,
      [EmployeeRequestType.EQUIPMENT]: SlackChannelFeature.EQUIPMENT,
      [EmployeeRequestType.CLOCK_FORGET]: SlackChannelFeature.CLOCK_FORGET,
      [EmployeeRequestType.OVERTIME]: SlackChannelFeature.OVERTIME,
      [EmployeeRequestType.BUSINESS_TRIP]: SlackChannelFeature.BUSINESS_TRIP,
    }

    return map[type]
  }
}
