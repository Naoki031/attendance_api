export interface VariableDefinition {
  name: string
  description: string
}

export interface TemplateKeyDefinition {
  key: string
  description: string
  variables: VariableDefinition[]
}

/**
 * Predefined email template keys with their descriptions and available variables.
 * Used by the seeder and exposed via API for the admin UI.
 */
export const TEMPLATE_KEYS: TemplateKeyDefinition[] = [
  {
    key: 'meeting_invite_rsvp',
    description: 'Sent when a participant is added to a scheduled meeting with RSVP links',
    variables: [
      { name: 'user_name', description: 'Participant full name' },
      { name: 'meeting_title', description: 'Meeting title' },
      { name: 'scheduled_at', description: 'Scheduled date and time' },
      { name: 'description', description: 'Meeting description' },
      { name: 'accept_url', description: 'RSVP accept link (single-use)' },
      { name: 'decline_url', description: 'RSVP decline link (single-use)' },
    ],
  },
  {
    key: 'request_submitted_off',
    description: 'Sent to approvers when an employee submits a leave request',
    variables: [
      { name: 'user_name', description: 'Requester full name' },
      { name: 'date_from', description: 'Start date/time' },
      { name: 'date_to', description: 'End date/time' },
      { name: 'reason', description: 'Reason for the request' },
      { name: 'approval_url', description: 'Link to review and approve/reject' },
    ],
  },
  {
    key: 'request_submitted_wfh',
    description: 'Sent to approvers when an employee submits a work-from-home request',
    variables: [
      { name: 'user_name', description: 'Requester full name' },
      { name: 'date_from', description: 'Start date/time' },
      { name: 'date_to', description: 'End date/time' },
      { name: 'reason', description: 'Reason for the request' },
      { name: 'approval_url', description: 'Link to review and approve/reject' },
    ],
  },
  {
    key: 'request_submitted_overtime',
    description: 'Sent to approvers when an employee submits an overtime request',
    variables: [
      { name: 'user_name', description: 'Requester full name' },
      { name: 'date_from', description: 'Start date/time' },
      { name: 'date_to', description: 'End date/time' },
      { name: 'reason', description: 'Reason for the request' },
      { name: 'approval_url', description: 'Link to review and approve/reject' },
    ],
  },
  {
    key: 'request_submitted_equipment',
    description: 'Sent to approvers when an employee submits an equipment request',
    variables: [
      { name: 'user_name', description: 'Requester full name' },
      { name: 'item_name', description: 'Equipment item name' },
      { name: 'reason', description: 'Reason for the request' },
      { name: 'approval_url', description: 'Link to review and approve/reject' },
    ],
  },
  {
    key: 'request_submitted_clock_forget',
    description: 'Sent to approvers when an employee submits a clock-forget request',
    variables: [
      { name: 'user_name', description: 'Requester full name' },
      { name: 'target_date', description: 'Date of the forgotten clock' },
      { name: 'clock_in_time', description: 'Requested clock-in time' },
      { name: 'clock_out_time', description: 'Requested clock-out time' },
      { name: 'reason', description: 'Reason for the request' },
      { name: 'approval_url', description: 'Link to review and approve/reject' },
    ],
  },
  {
    key: 'request_submitted_business_trip',
    description: 'Sent to approvers when an employee submits a business trip request',
    variables: [
      { name: 'user_name', description: 'Requester full name' },
      { name: 'date_from', description: 'Start date/time' },
      { name: 'date_to', description: 'End date/time' },
      { name: 'destination', description: 'Trip destination' },
      { name: 'reason', description: 'Purpose of the trip' },
      { name: 'approval_url', description: 'Link to review and approve/reject' },
    ],
  },
  {
    key: 'request_approved',
    description: 'Sent to the employee when their request has been approved',
    variables: [
      { name: 'user_name', description: 'Employee full name' },
      { name: 'request_type', description: 'Type of request' },
      { name: 'date_from', description: 'Start date/time' },
      { name: 'date_to', description: 'End date/time' },
      { name: 'approver_name', description: 'Approver full name' },
      { name: 'note', description: 'Approval note from the approver' },
    ],
  },
  {
    key: 'request_rejected',
    description: 'Sent to the employee when their request has been rejected',
    variables: [
      { name: 'user_name', description: 'Employee full name' },
      { name: 'request_type', description: 'Type of request' },
      { name: 'date_from', description: 'Start date/time' },
      { name: 'date_to', description: 'End date/time' },
      { name: 'approver_name', description: 'Approver full name' },
      { name: 'note', description: 'Rejection reason from the approver' },
    ],
  },
  {
    key: 'clock_in_reminder',
    description:
      'Sent 10 minutes before scheduled work start time if the employee has not clocked in',
    variables: [
      { name: 'user_name', description: 'Employee full name' },
      { name: 'scheduled_time', description: 'Scheduled work start time (HH:mm)' },
      { name: 'clock_url', description: 'Link to the attendance page for clock-in' },
    ],
  },
  {
    key: 'clock_out_reminder',
    description:
      'Sent 10 minutes after scheduled work end time if the employee has not clocked out',
    variables: [
      { name: 'user_name', description: 'Employee full name' },
      { name: 'scheduled_time', description: 'Scheduled work end time (HH:mm)' },
      { name: 'clock_url', description: 'Link to the attendance page for clock-out' },
    ],
  },
  {
    key: 'contract_expiry_reminder',
    description: 'Sent to company admins when an employee contract is about to expire',
    variables: [
      { name: 'admin_name', description: 'Admin full name' },
      { name: 'employee_name', description: 'Employee full name' },
      { name: 'contract_type', description: 'Contract type (Probation / Fixed Term)' },
      { name: 'expired_date', description: 'Contract expiry date (YYYY-MM-DD)' },
      { name: 'days_remaining', description: 'Days remaining until expiry' },
      { name: 'profile_url', description: 'Link to employee profile page' },
    ],
  },
]
