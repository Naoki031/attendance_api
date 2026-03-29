import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { BugReport, BugReportStatus } from './entities/bug_report.entity'
import { CreateBugReportDto } from './dto/create-bug_report.dto'
import { UpdateBugReportDto } from './dto/update-bug_report.dto'
import { User } from '@/modules/users/entities/user.entity'
import { SlackChannelsService } from '@/modules/slack_channels/slack_channels.service'
import { UserDepartment } from '@/modules/user_departments/entities/user_department.entity'

@Injectable()
export class BugReportsService {
  private readonly logger = new Logger(BugReportsService.name)
  private readonly uploadDir = path.resolve(process.cwd(), 'uploads', 'bug_reports')

  constructor(
    @InjectRepository(BugReport)
    private readonly bugReportRepository: Repository<BugReport>,
    @InjectRepository(UserDepartment)
    private readonly userDepartmentRepository: Repository<UserDepartment>,
    private readonly slackChannelsService: SlackChannelsService,
  ) {
    this.ensureUploadDir()
  }

  /**
   * Returns the company ID for the given user, or null if not found.
   */
  private async getUserCompanyId(userId: number): Promise<number | null> {
    const userDept = await this.userDepartmentRepository.findOne({
      where: { user_id: userId },
      select: ['company_id'],
    })
    return userDept?.company_id ?? null
  }

  private async ensureUploadDir(): Promise<void> {
    try {
      await fs.mkdir(this.uploadDir, { recursive: true })
    } catch (error) {
      this.logger.error('Failed to create upload directory:', error)
    }
  }

  private async saveScreenshot(base64Data: string): Promise<string | null> {
    if (!base64Data) return null

    try {
      const matches = base64Data.match(/^data:image\/(\w+);base64,(.+)$/)
      if (!matches) return null

      const extension = matches[1]
      const base64 = matches[2]
      const buffer = Buffer.from(base64, 'base64')
      const filename = `${Date.now()}_${Math.random().toString(36).substring(7)}.${extension}`
      const filepath = path.join(this.uploadDir, filename)

      await fs.writeFile(filepath, buffer)
      return `/uploads/bug_reports/${filename}`
    } catch (error) {
      this.logger.error('Failed to save screenshot:', error)
      return null
    }
  }

  async create(createDto: CreateBugReportDto, user: User): Promise<BugReport> {
    try {
      const screenshotPath = await this.saveScreenshot(createDto.screenshot ?? '')

      const created = await this.bugReportRepository.save({
        user_id: user.id,
        title: createDto.title,
        description: createDto.description,
        screenshot_path: screenshotPath,
        status: BugReportStatus.PENDING,
      })

      return this.findOne(created.id)
    } catch (error) {
      this.logger.error('Failed to create bug report:', error)
      const companyId = await this.getUserCompanyId(user.id)
      await this.slackChannelsService.sendError(
        `❌ **Failed to create bug report**\n*User:* ${user.full_name} (${user.email})\n*Title:* ${createDto.title}\n*Error:* ${error}`,
        companyId ?? undefined,
      )
      throw error
    }
  }

  async findByUser(userId: number): Promise<BugReport[]> {
    return this.bugReportRepository.find({
      where: { user_id: userId },
      relations: ['user'],
      order: { created_at: 'DESC' },
    })
  }

  async findAll(): Promise<BugReport[]> {
    return this.bugReportRepository.find({
      relations: ['user'],
      order: { created_at: 'DESC' },
    })
  }

  async findOne(id: number): Promise<BugReport> {
    const item = await this.bugReportRepository.findOne({
      where: { id },
      relations: ['user'],
    })
    if (!item) throw new NotFoundException('Bug report not found')

    return item
  }

  async update(id: number, updateDto: UpdateBugReportDto): Promise<BugReport> {
    try {
      await this.bugReportRepository.update({ id }, updateDto)
      return this.findOne(id)
    } catch (error) {
      this.logger.error('Failed to update bug report:', error)
      const report = await this.findOne(id).catch(() => null)
      const companyId = report ? await this.getUserCompanyId(report.user_id) : null
      await this.slackChannelsService.sendError(
        `❌ **Failed to update bug report**\n*Report ID:* ${id}\n*Title:* ${report?.title ?? 'N/A'}\n*Error:* ${error}`,
        companyId ?? undefined,
      )
      throw error
    }
  }

  async remove(id: number): Promise<void> {
    try {
      const report = await this.findOne(id)

      if (report.screenshot_path) {
        const filename = path.basename(report.screenshot_path)
        const filepath = path.join(this.uploadDir, filename)
        try {
          await fs.unlink(filepath)
        } catch (error) {
          this.logger.warn(`Failed to delete screenshot ${filepath}:`, error)
        }
      }

      await this.bugReportRepository.delete({ id })
    } catch (error) {
      this.logger.error('Failed to delete bug report:', error)
      const companyId = await this.getUserCompanyId(id)
      await this.slackChannelsService.sendError(
        `❌ **Failed to delete bug report**\n*Report ID:* ${id}\n*Error:* ${error}`,
        companyId ?? undefined,
      )
      throw error
    }
  }
}
