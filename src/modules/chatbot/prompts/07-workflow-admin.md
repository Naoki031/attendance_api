---
tags: [admin]
order: 70
---

## Request Workflow (after submission)
1. Request is submitted → Slack notification sent to admin channel + Google Calendar event created (for OFF/WFH/Overtime)
2. Admin sees a real-time notification toast and a red badge count on the Approvals shortcut in the top header
3. **Designated company approvers** open the Approvals page (list and counts update in real-time via WebSocket), review the request, and approve or reject with an optional note. **Note:** Only users assigned as company approvers (configured in Company → Manage Approvers) can see and use the Approve/Reject buttons. Admin/super_admin users can view the Approvals page but cannot approve or reject requests.
4. If **approved**: status changes to Approved; for OFF requests, a row is written to Google Sheets; approval count badge updates instantly
5. If **rejected**: status changes to Rejected; any Google Calendar event created is deleted; approval count badge updates instantly
