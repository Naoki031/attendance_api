import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as nodemailer from 'nodemailer'
import { ErrorLogsService } from '@/modules/error_logs/error_logs.service'
import { EmailTemplatesService } from '@/modules/email_templates/email_templates.service'
import { escapeHtml } from '@/common/utils/escape-html.utility'

export interface SendMailOptions {
  to: string
  subject: string
  html: string
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name)
  private readonly transporter: nodemailer.Transporter

  constructor(
    private readonly configService: ConfigService,
    private readonly errorLogsService: ErrorLogsService,
    private readonly emailTemplatesService: EmailTemplatesService,
  ) {
    // ConfigService.get() always returns a string from env vars — parse explicitly
    const secure = this.configService.get('MAIL_SECURE') === 'true'
    const port = Number(this.configService.get('MAIL_PORT') ?? 587)
    const mailUser = this.configService.get<string>('MAIL_USER', '')
    const mailPass = this.configService.get<string>('MAIL_PASS', '')
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('MAIL_HOST', 'smtp.gmail.com'),
      port,
      secure,
      // requireTLS: mandatory STARTTLS when secure=false (e.g. port 587).
      // Without this Nodemailer negotiates TLS opportunistically — Gmail rejects
      // any AUTH command sent before STARTTLS with "530 Must issue a STARTTLS command first".
      requireTLS: !secure,
      ...(mailUser
        ? {
            auth: {
              user: mailUser,
              pass: mailPass,
            },
          }
        : {}),
    })
  }

  /**
   * Sends an email. Logs and swallows errors so a mail failure never crashes the calling flow.
   */
  async send(options: SendMailOptions): Promise<void> {
    const from = this.configService.get<string>('MAIL_FROM', 'Attendance <noreply@attendance.app>')
    try {
      await this.transporter.sendMail({
        from,
        to: options.to,
        subject: options.subject,
        html: options.html,
      })
      this.logger.log(`Mail sent to ${options.to}: ${options.subject}`)
    } catch (error) {
      this.logger.error(`Failed to send mail to ${options.to}: ${(error as Error).message}`)
      this.errorLogsService.logError({
        message: `Failed to send mail to ${options.to}: ${(error as Error).message}`,
        stackTrace: (error as Error).stack ?? null,
        path: 'mail',
      })
    }
  }

  /**
   * Sends an email using a DB-backed template identified by key.
   * Looks up company-specific template first, then falls back to global.
   * If no template is found, the email is silently skipped.
   * Variables use {{variable_name}} syntax. All variable values are HTML-escaped.
   */
  async sendTemplate(
    templateKey: string,
    to: string,
    variables: Record<string, string>,
    companyId?: number,
  ): Promise<void> {
    try {
      const template = await this.emailTemplatesService.findByKey(templateKey, companyId)
      if (!template) {
        this.logger.warn(`Email template "${templateKey}" not found — skipping email to ${to}`)
        return
      }

      const subject = this.renderVariables(template.subject, variables)
      const html = this.renderVariables(template.body_html, variables)
      await this.send({ to, subject, html })
    } catch (error) {
      this.logger.error(
        `Failed to send template email "${templateKey}" to ${to}: ${(error as Error).message}`,
      )
      this.errorLogsService.logError({
        message: `Failed to send template email "${templateKey}" to ${to}: ${(error as Error).message}`,
        stackTrace: (error as Error).stack ?? null,
        path: 'mail',
      })
    }
  }

  /**
   * Replaces {{variable}} placeholders with HTML-escaped values.
   * Unmatched placeholders are left as-is so the recipient sees what's missing.
   */
  private renderVariables(template: string, variables: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
      return variables[key] !== undefined ? escapeHtml(variables[key]) : _match
    })
  }
}
