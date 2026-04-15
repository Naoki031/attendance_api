---
tags: [admin]
order: 35
---

### For Admins (Management section):

**Organization:**
- **Users**: Manage employee accounts, assign departments, set device IDs for biometric sync. The **Skip Attendance** toggle excludes a user from attendance tracking — the auto-fill absences cron and ZK device sync will ignore them. Use this for test accounts, auditors, or anyone who doesn't need attendance tracking. The **Permanent Remote** toggle marks a user as permanently remote — they do not need to submit daily WFH requests and can clock in/out from anywhere. Each user row has action buttons: **Edit** (update profile), **Manage Departments** (assign/remove department), **Manage Work Schedule** (set a custom schedule or use company default), **Cancel KYC** (reset face registration so employee can re-submit), and **Delete**.
- **Companies**: Configure company info, work hours (start/end time), allowed IP addresses for QR clock-in, and Google Calendar ID
- **Departments**: Manage company departments
- **Teams**: Create and manage cross-department teams for Slack group mentions. Go to **Management → Teams**.
  - **Create a team**: Click **"Create"** → fill in Name, Slug (auto-fills from name), optionally Company, Description, Slack Channel ID, Slack User Group ID → **Save**.
  - **Add members**: On the team row click the **"Manage Members"** icon (people icon, teal color) → in the **Manage Members** dialog click the **"Add member"** button (bottom-left) → a new **"Add member"** dialog opens: select a **Company** from the dropdown (the **User** field below auto-loads all users in that company) → click users in the **User** dropdown to select them (each selected user appears as a removable chip; you can also type to filter by name) → the **"Add (N)"** button at bottom-right shows how many users will be added — click it to confirm.
  - **Remove a member**: In the **"Manage Members"** dialog, click the **×** button on the right of the member row.
- **Cities / Countries**: Manage location data

**Access Control:**
- **Roles**: Define user roles
- **Permissions**: Define permission entries
- **Permission Groups**: Bundle permissions into groups and assign to users

**Requests:**
- **Approvals**: Review and approve/reject pending employee requests. **Only designated company approvers** (configured per company via **Company → Manage Approvers**) can approve or reject requests. Other admins can view but cannot approve. Approved requests sync to Google Calendar and Google Sheets
- **Request History**: View all past requests with filters (month/year, status, request type). Click **Export Excel** to download the filtered list as a spreadsheet.
- **Bug Reports**: View and manage bug reports submitted by users. You can update the status (pending/in progress/resolved) and add admin notes for tracking resolution progress. Each report includes the submitter's info, title, description, and optional screenshot.

**Attendance:**
- **How It Works**: A static guide page explaining all attendance methods (ZKTeco fingerprint device, QR clock, App clock, Face check-in) — including prerequisites, requirements, and how each method is validated. Useful for onboarding new admins or troubleshooting.
- **Attendance Logs**: View detailed daily attendance logs for all employees, export to Google Sheets. Admins can also **edit clock-in/clock-out times** for any log entry (requires a reason). Every edit is saved to an **edit history**, which can be reviewed per entry by clicking the history icon. For face check-in entries, click the **camera icon** to view the captured check-in photo along with the confidence score.
- **KYC Management**: Review face registration submissions from employees. KYC is the process where an employee submits a face photo from their Profile page — the system extracts a face descriptor and sets status to "pending". Each card shows the submitted face photo, name, and date. Use the **filter tabs** (All / Pending / Approved / Rejected) to organise the queue. Click **Approve** to activate face check-in for that employee, or **Reject** (with an optional reason) to send it back. You will receive a push notification when a new KYC is submitted. You can also cancel any employee's KYC from the **User Management** page — this resets them to unregistered so they can re-submit.

**Integrations:**
- **Slack Channels**: Configure Slack webhooks for request notifications. Each channel can optionally attach a clickable link to the **Approvals page** and/or the **My Requests page** in the notification message (toggle "Include link to Approvals page" / "Include link to My Requests page" in the channel settings). When writing a **Message Template**, only variables relevant to the selected feature type are shown — e.g. `leave_type` only appears for OFF, `equipment_name` only for Equipment, `trip_destination` only for Business Trip. Available variables include `cc_users` (mentions CC'd colleagues) for all request types. Supported feature types: WFH, Leave (OFF), Equipment, Clock Forget, Overtime, **Business Trip**, and Error notifications.
- **Google Sheets**: Configure Google Sheets integration per request type or for attendance logs (column mapping, spreadsheet ID, sheet name). Supported types: WFH, OFF, Equipment, Clock Forget, Overtime, **Business Trip**, and Attendance Logs. When a specific request type is selected, the **Field** dropdown filters to show only columns relevant to that type — e.g. `trip_destination` only appears when Business Trip is selected.

**Logs & Monitoring:**
- **Error Logs**: View system-level application errors. Stats cards show total, unresolved, and error-level counts at a glance. You can **resolve** multiple entries at once using the batch resolve button (appears when rows are selected), or **purge old logs** to clean up stale records. Each entry includes the error message, level, timestamp, and stack details.
- **Translation Logs**: Monitor AI translation usage. Stats show total requests, cache hit rate, tokens saved rate, and error rate. Use **Purge Old** to delete stale entries. Useful for auditing translation costs and diagnosing translation failures.

**Configuration:**
- **Email Templates**: Manage email notification templates per company and per event type. Filter by company or template key. Create, edit, or delete templates — each template has a key, company scope, subject, and body content.

**Settings:**
- **System Settings**: Admin-only configuration panel. Currently includes the **Chatbot** section where you can reload chatbot prompt files from disk without restarting the server (useful after editing prompt markdown files). Click **"Reload"** to refresh all prompt sections immediately.
