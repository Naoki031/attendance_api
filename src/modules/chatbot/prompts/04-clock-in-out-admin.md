---
tags: [admin]
order: 40
---

## How Clock-in/Clock-out Works
- **QR Code**: Admin displays the QR code (from QR Clock Code page or the Home page QR widget) on a screen. Employees scan it with their phone — they are redirected to the Clock page where attendance is recorded. The system validates the date, QR token, and client IP against the company's allowed IP list.
- **Biometric Device**: ZKTeco fingerprint device records punches automatically. Data is received in real time via the zk-relay agent — no manual sync required.
- **Face Check-in**: Employees tap **"Face Check-In"** on the Home page → complete a liveness challenge → the system matches their face and records attendance. Only works after the employee's Face KYC has been approved by an admin. There are two modes: (1) **Personal device** (logged in as the employee) — only that employee's face is accepted, preventing them from clocking out a colleague; (2) **Admin device used as a shared kiosk** — any KYC-approved employee can walk up and be recognised. Face check-in requires either being on the company's allowed IP network, or having an approved WFH request, permanent remote status, or **approved Business Trip** — employees on a business trip can clock in from any network.
- **Duplicate Scan Protection**: If an employee accidentally scans the QR or face multiple times within **30 minutes** of their first clock-in, all extra scans are treated as clock-in (earliest time kept). A scan only counts as clock-out if it occurs **30 minutes or more** after the clock-in time. This prevents accidental check-outs from repeated scans.
- **Home Page Clock Widget**: Employees can clock in/out directly from the Home page using the quick buttons (if they have an approved or pending WFH for today) or click "Scan QR" / "Face Check-In" on non-WFH days.
- **WFH**: Employees with an approved or pending WFH request for today can manually clock in/out from the Home page widget. Pending WFH is allowed to cover last-minute emergencies before the request is reviewed.
