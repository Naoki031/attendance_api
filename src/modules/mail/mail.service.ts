import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as nodemailer from 'nodemailer'

export interface SendMailOptions {
  to: string
  subject: string
  html: string
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name)
  private readonly transporter: nodemailer.Transporter

  constructor(private readonly configService: ConfigService) {
    // ConfigService.get() always returns a string from env vars — parse explicitly
    const secure = this.configService.get('MAIL_SECURE') === 'true'
    const port = Number(this.configService.get('MAIL_PORT') ?? 587)
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('MAIL_HOST', 'smtp.gmail.com'),
      port,
      secure,
      ignoreTLS: !secure,
      auth: {
        user: this.configService.get<string>('MAIL_USER', ''),
        pass: this.configService.get<string>('MAIL_PASS', ''),
      },
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
    }
  }
}
