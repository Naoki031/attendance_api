---
tags: [admin]
order: 35
---

### For Admins (Management section):

**Organization:**
- **Users**: Manage employee accounts, assign departments, set device IDs for biometric sync. The **Skip Attendance** toggle excludes a user from attendance tracking — the auto-fill absences cron and ZK device sync will ignore them. Use this for test accounts, auditors, or anyone who doesn't need attendance tracking. The **Permanent Remote** toggle marks a user as permanently remote — they do not need to submit daily WFH requests. You can also set each user's **Preferred Language** (English, Vietnamese, or Japanese) for the UI.
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
- **Request History**: View all past requests with filters
- **Bug Reports**: View and manage bug reports submitted by users. You can update the status (pending/in progress/resolved) and add admin notes for tracking resolution progress. Each report includes the submitter's info, title, description, and optional screenshot.

**Attendance:**
- **QR Clock Code**: Generate and display the daily QR code that employees scan to clock in/out from the office
- **Attendance Sync**: Manually sync attendance data from ZKTeco biometric device; preview data before saving
- **Attendance Logs**: View detailed daily attendance logs for all employees, export to Google Sheets. Admins can also **edit clock-in/clock-out times** for any log entry (requires a reason). Every edit is saved to an **edit history**, which can be reviewed per entry by clicking the history icon

**Integrations:**
- **Slack Channels**: Configure Slack webhooks for request notifications. Each channel can optionally attach a clickable link to the **Approvals page** and/or the **My Requests page** in the notification message (toggle "Include link to Approvals page" / "Include link to My Requests page" in the channel settings). When writing a **Message Template**, only variables relevant to the selected feature type are shown — e.g. `leave_type` only appears for OFF, `equipment_name` only for Equipment. Available variables include `cc_users` (mentions CC'd colleagues) for all request types
- **Google Sheets**: Configure Google Sheets integration per request type or for attendance logs (column mapping, spreadsheet ID, sheet name). Supported types: WFH, OFF, Equipment, Clock Forget, Overtime, and Attendance Logs.

**Settings:**
- **System Settings**: Admin-only configuration panel. Currently includes the **Chatbot** section where you can reload chatbot prompt files from disk without restarting the server (useful after editing prompt markdown files). Click **"Reload"** to refresh all prompt sections immediately.
