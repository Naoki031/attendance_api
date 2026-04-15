import { DataSource } from 'typeorm'
import { Seeder, SeederFactoryManager } from 'typeorm-extension'
import { EmailTemplate } from '../../../modules/email_templates/entities/email_template.entity'

const defaultTemplates: Partial<EmailTemplate>[] = [
  {
    key: 'meeting_invite_rsvp',
    subject: 'Meeting invitation: {{meeting_title}}',
    body_html: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
  <h2>You have been invited to a meeting</h2>
  <p>Hi {{user_name}},</p>
  <p>You have been invited to: <strong>{{meeting_title}}</strong></p>
  <p><strong>When:</strong> {{scheduled_at}}</p>
  <p><strong>Description:</strong> {{description}}</p>
  <p>Please respond to this invitation:</p>
  <div style="margin: 24px 0;">
    <a href="{{accept_url}}" style="background:#4caf50;color:#fff;padding:12px 24px;border-radius:4px;text-decoration:none;margin-right:8px;">Accept</a>
    <a href="{{decline_url}}" style="background:#f44336;color:#fff;padding:12px 24px;border-radius:4px;text-decoration:none;">Decline</a>
  </div>
  <p style="color:#999;font-size:12px;">This link is single-use and will expire after you respond.</p>
</div>`,
    description: 'Sent when a participant is added to a scheduled meeting with RSVP links',
    variables: [
      'user_name',
      'meeting_title',
      'scheduled_at',
      'description',
      'accept_url',
      'decline_url',
    ],
    is_system: true,
    company_id: null,
  },
  {
    key: 'request_submitted_off',
    subject: 'New leave request from {{user_name}}',
    body_html: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
  <h2>New Leave Request</h2>
  <p><strong>{{user_name}}</strong> has submitted a <strong>Leave Request</strong>.</p>
  <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">From</td><td style="padding: 8px; border: 1px solid #ddd;">{{date_from}}</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">To</td><td style="padding: 8px; border: 1px solid #ddd;">{{date_to}}</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Reason</td><td style="padding: 8px; border: 1px solid #ddd;">{{reason}}</td></tr>
  </table>
  <div style="margin: 24px 0;">
    <a href="{{approval_url}}" style="background:#1976d2;color:#fff;padding:12px 24px;border-radius:4px;text-decoration:none;">Review Request</a>
  </div>
</div>`,
    description: 'Sent to approvers when an employee submits a leave request',
    variables: ['user_name', 'date_from', 'date_to', 'reason', 'approval_url'],
    is_system: true,
    company_id: null,
  },
  {
    key: 'request_submitted_wfh',
    subject: 'New work-from-home request from {{user_name}}',
    body_html: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
  <h2>New Work-From-Home Request</h2>
  <p><strong>{{user_name}}</strong> has submitted a <strong>Work-From-Home</strong> request.</p>
  <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">From</td><td style="padding: 8px; border: 1px solid #ddd;">{{date_from}}</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">To</td><td style="padding: 8px; border: 1px solid #ddd;">{{date_to}}</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Reason</td><td style="padding: 8px; border: 1px solid #ddd;">{{reason}}</td></tr>
  </table>
  <div style="margin: 24px 0;">
    <a href="{{approval_url}}" style="background:#1976d2;color:#fff;padding:12px 24px;border-radius:4px;text-decoration:none;">Review Request</a>
  </div>
</div>`,
    description: 'Sent to approvers when an employee submits a work-from-home request',
    variables: ['user_name', 'date_from', 'date_to', 'reason', 'approval_url'],
    is_system: true,
    company_id: null,
  },
  {
    key: 'request_submitted_overtime',
    subject: 'New overtime request from {{user_name}}',
    body_html: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
  <h2>New Overtime Request</h2>
  <p><strong>{{user_name}}</strong> has submitted an <strong>Overtime</strong> request.</p>
  <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">From</td><td style="padding: 8px; border: 1px solid #ddd;">{{date_from}}</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">To</td><td style="padding: 8px; border: 1px solid #ddd;">{{date_to}}</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Reason</td><td style="padding: 8px; border: 1px solid #ddd;">{{reason}}</td></tr>
  </table>
  <div style="margin: 24px 0;">
    <a href="{{approval_url}}" style="background:#1976d2;color:#fff;padding:12px 24px;border-radius:4px;text-decoration:none;">Review Request</a>
  </div>
</div>`,
    description: 'Sent to approvers when an employee submits an overtime request',
    variables: ['user_name', 'date_from', 'date_to', 'reason', 'approval_url'],
    is_system: true,
    company_id: null,
  },
  {
    key: 'request_submitted_equipment',
    subject: 'New equipment request from {{user_name}}',
    body_html: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
  <h2>New Equipment Request</h2>
  <p><strong>{{user_name}}</strong> has submitted an <strong>Equipment</strong> request.</p>
  <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Item</td><td style="padding: 8px; border: 1px solid #ddd;">{{item_name}}</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Reason</td><td style="padding: 8px; border: 1px solid #ddd;">{{reason}}</td></tr>
  </table>
  <div style="margin: 24px 0;">
    <a href="{{approval_url}}" style="background:#1976d2;color:#fff;padding:12px 24px;border-radius:4px;text-decoration:none;">Review Request</a>
  </div>
</div>`,
    description: 'Sent to approvers when an employee submits an equipment request',
    variables: ['user_name', 'item_name', 'reason', 'approval_url'],
    is_system: true,
    company_id: null,
  },
  {
    key: 'request_submitted_clock_forget',
    subject: 'New clock-forget request from {{user_name}}',
    body_html: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
  <h2>New Clock-Forget Request</h2>
  <p><strong>{{user_name}}</strong> has submitted a <strong>Clock-Forget</strong> request.</p>
  <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Date</td><td style="padding: 8px; border: 1px solid #ddd;">{{target_date}}</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Clock In</td><td style="padding: 8px; border: 1px solid #ddd;">{{clock_in_time}}</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Clock Out</td><td style="padding: 8px; border: 1px solid #ddd;">{{clock_out_time}}</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Reason</td><td style="padding: 8px; border: 1px solid #ddd;">{{reason}}</td></tr>
  </table>
  <div style="margin: 24px 0;">
    <a href="{{approval_url}}" style="background:#1976d2;color:#fff;padding:12px 24px;border-radius:4px;text-decoration:none;">Review Request</a>
  </div>
</div>`,
    description: 'Sent to approvers when an employee submits a clock-forget request',
    variables: [
      'user_name',
      'target_date',
      'clock_in_time',
      'clock_out_time',
      'reason',
      'approval_url',
    ],
    is_system: true,
    company_id: null,
  },
  {
    key: 'request_submitted_business_trip',
    subject: 'New business trip request from {{user_name}}',
    body_html: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
  <h2>New Business Trip Request</h2>
  <p><strong>{{user_name}}</strong> has submitted a <strong>Business Trip</strong> request.</p>
  <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">From</td><td style="padding: 8px; border: 1px solid #ddd;">{{date_from}}</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">To</td><td style="padding: 8px; border: 1px solid #ddd;">{{date_to}}</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Destination</td><td style="padding: 8px; border: 1px solid #ddd;">{{destination}}</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Purpose</td><td style="padding: 8px; border: 1px solid #ddd;">{{reason}}</td></tr>
  </table>
  <div style="margin: 24px 0;">
    <a href="{{approval_url}}" style="background:#1976d2;color:#fff;padding:12px 24px;border-radius:4px;text-decoration:none;">Review Request</a>
  </div>
</div>`,
    description: 'Sent to approvers when an employee submits a business trip request',
    variables: ['user_name', 'date_from', 'date_to', 'destination', 'reason', 'approval_url'],
    is_system: true,
    company_id: null,
  },
  {
    key: 'request_approved',
    subject: 'Your {{request_type}} request has been approved',
    body_html: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
  <h2>Request Approved</h2>
  <p>Hi {{user_name}},</p>
  <p>Your <strong>{{request_type}}</strong> request has been <span style="color: #4caf50; font-weight: bold;">approved</span>.</p>
  <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">From</td><td style="padding: 8px; border: 1px solid #ddd;">{{date_from}}</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">To</td><td style="padding: 8px; border: 1px solid #ddd;">{{date_to}}</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Approved by</td><td style="padding: 8px; border: 1px solid #ddd;">{{approver_name}}</td></tr>
  </table>
  <p><strong>Note:</strong> {{note}}</p>
</div>`,
    description: 'Sent to the employee when their request is approved',
    variables: ['user_name', 'request_type', 'date_from', 'date_to', 'approver_name', 'note'],
    is_system: true,
    company_id: null,
  },
  {
    key: 'request_rejected',
    subject: 'Your {{request_type}} request has been rejected',
    body_html: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
  <h2>Request Rejected</h2>
  <p>Hi {{user_name}},</p>
  <p>Your <strong>{{request_type}}</strong> request has been <span style="color: #f44336; font-weight: bold;">rejected</span>.</p>
  <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">From</td><td style="padding: 8px; border: 1px solid #ddd;">{{date_from}}</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">To</td><td style="padding: 8px; border: 1px solid #ddd;">{{date_to}}</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Rejected by</td><td style="padding: 8px; border: 1px solid #ddd;">{{approver_name}}</td></tr>
  </table>
  <p><strong>Reason:</strong> {{note}}</p>
</div>`,
    description: 'Sent to the employee when their request is rejected',
    variables: ['user_name', 'request_type', 'date_from', 'date_to', 'approver_name', 'note'],
    is_system: true,
    company_id: null,
  },
  {
    key: 'clock_in_reminder',
    subject: 'Reminder: Clock in for today (scheduled at {{scheduled_time}})',
    body_html: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
  <h2>Clock-In Reminder</h2>
  <p>Hi {{user_name}},</p>
  <p>This is a friendly reminder that your work day is scheduled to start at <strong>{{scheduled_time}}</strong> and you have not clocked in yet.</p>
  <p>Please clock in as soon as possible.</p>
  <div style="margin: 24px 0;">
    <a href="{{clock_url}}" style="background:#1976d2;color:#fff;padding:12px 24px;border-radius:4px;text-decoration:none;">Go to Attendance</a>
  </div>
  <p style="color:#999;font-size:12px;">This is an automated reminder. If you are on approved leave, please ignore this message.</p>
</div>`,
    description:
      'Sent 10 minutes before scheduled work start time if the employee has not clocked in',
    variables: ['user_name', 'scheduled_time', 'clock_url'],
    is_system: true,
    company_id: null,
  },
  {
    key: 'clock_out_reminder',
    subject: 'Reminder: You have not clocked out yet (scheduled end: {{scheduled_time}})',
    body_html: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
  <h2>Clock-Out Reminder</h2>
  <p>Hi {{user_name}},</p>
  <p>Your work day was scheduled to end at <strong>{{scheduled_time}}</strong> and it appears you have not clocked out yet.</p>
  <p>Please remember to clock out before leaving.</p>
  <div style="margin: 24px 0;">
    <a href="{{clock_url}}" style="background:#1976d2;color:#fff;padding:12px 24px;border-radius:4px;text-decoration:none;">Go to Attendance</a>
  </div>
  <p style="color:#999;font-size:12px;">This is an automated reminder. If you are working overtime, please ignore this message.</p>
</div>`,
    description:
      'Sent 10 minutes after scheduled work end time if the employee has not clocked out',
    variables: ['user_name', 'scheduled_time', 'clock_url'],
    is_system: true,
    company_id: null,
  },
]

export default class EmailTemplateSeeder implements Seeder {
  public async run(dataSource: DataSource, _factoryManager: SeederFactoryManager): Promise<void> {
    const repository = dataSource.getRepository(EmailTemplate)

    for (const templateData of defaultTemplates) {
      const existing = await repository.findOne({
        where: { key: templateData.key!, company_id: null },
      })
      if (!existing) {
        const template = repository.create(templateData)
        await repository.save(template)
      }
    }
  }
}
