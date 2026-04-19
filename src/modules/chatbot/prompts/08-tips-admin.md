---
tags: [admin]
order: 80
---

## Important distinctions

- **"Add a member to a team"** is NOT the same as creating a new user account. To add someone to a team: go to **Management → Teams**, click the teal people icon on the team row → **"Add member"** button → select company → pick users from the dropdown → **"Add (N)"**. Do NOT go to Users for this.
- **"Add a user to a department"** is done from **Management → Departments**: click the department row → **"Assign User"** button. Do NOT create a new user for this either.

## Tips
- The sidebar collapses to icon-only on desktop — hover over it to expand and see labels
- Pending approval count shows as a red badge on the Approvals icon in the top header bar and updates in real-time via WebSocket
- The Approvals page and all count badges update instantly when requests are created, approved, or rejected
- Work schedules can be customized per user or follow the company default
- When editing a clock-in/clock-out time in Attendance Logs, the save button is disabled until the time values actually differ from the original — this prevents saving redundant edits
- Every clock-in/clock-out edit is logged with the admin's name, timestamp, and reason. Click the history icon on any row to review the full audit trail
- Regularly review the **Bug Reports** page to track and resolve issues reported by users. Update the status to keep submitters informed about resolution progress
- When an employee submits a Face KYC, you will receive a **push notification** and a badge count appears on the KYC icon in the top header. Go to **Management → KYC Management** to review — approve or reject with an optional reason
- In **Attendance Logs**, click the **camera icon** on any face check-in entry to view the captured photo and confidence score — useful for verifying disputed attendance records
- To reset an employee's face registration (so they can re-submit), click the **Cancel KYC** button on their row in **Management → Users**
- Chat emoji reactions are **exclusive per user per message** — each user can only have one reaction; picking a new emoji automatically replaces the previous one
- Use **Sections** in the Chat room list to organize rooms by team or project — click **"Manage Sections"** at the top, then move rooms via ⋮ → **"Move to section"**. Sections collapse/expand on click
- In Chat, use the **formatting toolbar** (toggle with the toolbar button) to compose messages with Bold, Italic, Underline, Strikethrough, Inline Code, Code Block, Blockquote, Bullet List, and Ordered List
- Type **@name** in Chat to mention a member and send them a highlighted notification; use arrow keys or click to pick from the autocomplete dropdown
- As a room admin, you can **kick** members from the room via the **member sidebar** (click the members icon, top-right of the room)
- In **Meetings**, use the **host schedule** feature to rotate hosts automatically — useful for daily standups where different team members take turns leading
- Admins can **edit and delete** any user's meeting (not just their own) — useful when a meeting creator leaves the company
- As a meeting host, you can **pre-assign co-hosts from the meeting list** (without entering the room): click the ⋮ menu on a meeting card → **"Manage Co-Hosts"**. You can also promote/demote from inside the room via the control bar. Co-hosts can **invite people**, **edit the meeting schedule/time only** (not title, description, privacy, or companies), **manage host schedules**, **configure auto-call settings**, and **end the meeting**, but cannot transfer host, manage other co-hosts, or add/remove scheduled participants
- Use **Sections** in the meeting list to organize rooms by project or team — click **"Manage Sections"** at the top of the meeting list page to create/rename/delete sections, then assign meetings via ⋮ → **"Move to section"**
- Use **Scheduled Participants** (⋮ → "Manage Scheduled Participants") to pre-invite specific users for recurring meetings. Enable **Auto-call** to have the system ring them automatically before the meeting starts — configure minutes before, retry count, retry interval, and skip-weekends option
- Inside a meeting room, the **Chat** panel (control bar chat button) supports full threaded messaging, message pinning, and auto-translate — useful for sharing links and notes without disrupting the audio

- To share a **Memories album** to a team chat room, open the album and click **"Share album"** in the hero section — choose the room and add an optional message. The album appears as a clickable card in chat showing the cover photo, title, photo count, and event type
