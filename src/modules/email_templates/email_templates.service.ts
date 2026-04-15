import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
  HttpException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { EmailTemplate } from './entities/email_template.entity'
import { CreateEmailTemplateDto } from './dto/create-email-template.dto'
import { UpdateEmailTemplateDto } from './dto/update-email-template.dto'
import { ErrorLogsService } from '@/modules/error_logs/error_logs.service'
import { TEMPLATE_KEYS, type TemplateKeyDefinition } from './constants/template-keys.constant'

@Injectable()
export class EmailTemplatesService {
  private readonly logger = new Logger(EmailTemplatesService.name)

  constructor(
    @InjectRepository(EmailTemplate)
    private readonly templateRepository: Repository<EmailTemplate>,
    private readonly errorLogsService: ErrorLogsService,
  ) {}

  /**
   * Returns all predefined template key definitions with their available variables.
   */
  getTemplateKeys(): TemplateKeyDefinition[] {
    return TEMPLATE_KEYS
  }

  async create(dto: CreateEmailTemplateDto): Promise<EmailTemplate> {
    try {
      // Check duplicate: same key + same company scope (including null for global)
      // Use withDeleted() to also catch soft-deleted templates occupying the key slot
      const existing = await this.templateRepository.findOne({
        where: { key: dto.key, company_id: dto.company_id ?? null },
        withDeleted: true,
      })
      if (existing) {
        const scope = dto.company_id ? `company #${dto.company_id}` : 'global'
        throw new ConflictException(`Template key "${dto.key}" already exists for ${scope}`)
      }
      if (existing) {
        const scope = dto.company_id ? `company #${dto.company_id}` : 'global'
        throw new ConflictException(`Template key "${dto.key}" already exists for ${scope}`)
      }

      const template = this.templateRepository.create({
        key: dto.key,
        subject: dto.subject,
        body_html: dto.body_html,
        description: dto.description,
        variables: dto.variables,
        is_system: false,
        company_id: dto.company_id ?? null,
      })
      return await this.templateRepository.save(template)
    } catch (error) {
      if (!(error instanceof HttpException)) {
        this.logger.error('Failed to create email template', error)
        this.errorLogsService.logError({
          message: 'Failed to create email template',
          stackTrace: (error as Error).stack ?? null,
          path: 'email_templates',
        })
      }
      throw error
    }
  }

  async findAll(companyId?: number): Promise<EmailTemplate[]> {
    try {
      if (companyId) {
        // Return company-specific + global templates
        return await this.templateRepository.find({
          where: [{ company_id: companyId }, { company_id: null }],
          relations: ['company'],
          order: { company_id: 'DESC', created_at: 'DESC' },
        })
      }
      return await this.templateRepository.find({
        relations: ['company'],
        order: { created_at: 'DESC' },
      })
    } catch (error) {
      if (!(error instanceof HttpException)) {
        this.logger.error('Failed to find email templates', error)
        this.errorLogsService.logError({
          message: 'Failed to find email templates',
          stackTrace: (error as Error).stack ?? null,
          path: 'email_templates',
        })
      }
      throw error
    }
  }

  async findOne(id: number): Promise<EmailTemplate> {
    try {
      const template = await this.templateRepository.findOne({ where: { id } })
      if (!template) throw new NotFoundException(`Email template #${id} not found`)
      return template
    } catch (error) {
      if (!(error instanceof HttpException)) {
        this.logger.error('Failed to find email template', error)
        this.errorLogsService.logError({
          message: 'Failed to find email template',
          stackTrace: (error as Error).stack ?? null,
          path: 'email_templates',
        })
      }
      throw error
    }
  }

  /**
   * Finds a template by key with company fallback:
   * 1. Look for a company-specific template (company_id = given companyId)
   * 2. Fall back to global template (company_id IS NULL)
   */
  async findByKey(key: string, companyId?: number): Promise<EmailTemplate | null> {
    try {
      // Try company-specific first
      if (companyId) {
        const companyTemplate = await this.templateRepository.findOne({
          where: { key, company_id: companyId },
        })
        if (companyTemplate) return companyTemplate
      }

      // Fall back to global
      return await this.templateRepository.findOne({
        where: { key, company_id: null },
      })
    } catch (error) {
      this.logger.error('Failed to find email template by key', error)
      this.errorLogsService.logError({
        message: 'Failed to find email template by key',
        stackTrace: (error as Error).stack ?? null,
        path: 'email_templates',
      })
      return null
    }
  }

  async update(id: number, dto: UpdateEmailTemplateDto): Promise<EmailTemplate> {
    try {
      const template = await this.findOne(id)

      if (dto.subject !== undefined) template.subject = dto.subject
      if (dto.body_html !== undefined) template.body_html = dto.body_html
      if (dto.description !== undefined) template.description = dto.description
      if (dto.variables !== undefined) template.variables = dto.variables
      if (dto.company_id !== undefined) {
        // Check for duplicate key + new company_id (including soft-deleted)
        const newCompanyId = dto.company_id ?? null
        if (newCompanyId !== template.company_id) {
          const duplicate = await this.templateRepository.findOne({
            where: { key: template.key, company_id: newCompanyId },
            withDeleted: true,
          })
          if (duplicate) {
            const scope = newCompanyId ? `company #${newCompanyId}` : 'global'
            throw new ConflictException(
              `Template key "${template.key}" already exists for ${scope}`,
            )
          }
        }
        template.company_id = dto.company_id
      }

      return await this.templateRepository.save(template)
    } catch (error) {
      if (!(error instanceof HttpException)) {
        this.logger.error('Failed to update email template', error)
        this.errorLogsService.logError({
          message: 'Failed to update email template',
          stackTrace: (error as Error).stack ?? null,
          path: 'email_templates',
        })
      }
      throw error
    }
  }

  async remove(id: number): Promise<void> {
    try {
      const template = await this.findOne(id)
      if (template.is_system) {
        throw new BadRequestException('System templates cannot be deleted')
      }
      await this.templateRepository.softDelete({ id })
    } catch (error) {
      if (!(error instanceof HttpException)) {
        this.logger.error('Failed to remove email template', error)
        this.errorLogsService.logError({
          message: 'Failed to remove email template',
          stackTrace: (error as Error).stack ?? null,
          path: 'email_templates',
        })
      }
      throw error
    }
  }
}
