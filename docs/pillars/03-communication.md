# Pillar 3 — Communication

**Product:** EduOS · **Layer:** 3 · **Sidebar:** Communication → Communication Hub

---

## Purpose

The Communication Engine sends **event-driven messages** across WhatsApp, email, SMS, and push. One trigger (absence, test result, class tomorrow) can notify parents on the channels you enable.

In demo mode, messages are **simulated** unless you configure live API credentials.

---

## Who uses it

| Role | Access |
|------|--------|
| Center admin | Full Communication Hub |
| Teacher | Messages tab (own comms) |
| Parent | Messages in Parent Portal |

---

## Modules & functionalities

**Path:** Communication → Communication Hub

| Tab | Function |
|-----|----------|
| Dashboard | Message totals, success rate, active automations, recent messages |
| Automations | Event → channel → template rules (enable/disable) |
| Templates | Reusable message bodies per event and channel |
| Channels | Enable email, SMS, push, voice; auto-triggers on attendance/tests/homework |
| Reminders | Class reminders (24h), homework due, broadcast to all parents |
| Send | One-off message to phone/email on chosen channel |
| Event Log | Full message history with channel filter |

**Top bar:** **Quick Message** jumps to comm hub (when permitted).

**WhatsApp credentials:** **Settings → WhatsApp Business API** (Meta token + Phone Number ID). Without these, WhatsApp sends are simulated locally.

---

## How to use — step by step

### A. Configure channels

1. Open **Communication Hub → Channels**.
2. Set **Email from** address; toggle Email, SMS, Push, Voice as needed.
3. Enable auto-triggers:
   - Auto on attendance events
   - Auto on test results
   - Auto on homework due
   - Auto on teacher feedback
4. Click **Save Settings**.

### B. Manage templates

1. **Templates tab → + Template**.
2. Name the template, pick channel and event type, write body text.
3. Use templates in automations for consistent parent messaging.

### C. Set up automations

1. **Automations tab → + Automation**.
2. Choose event (e.g. student absent, test published).
3. Select channels and linked template.
4. Enable automation — toggle **Active** badge should show green.

### D. Send class & homework reminders

1. **Reminders tab** — enable calendar reminders.
2. Click **Send Class Reminders (24h)** before tomorrow's sessions.
3. Click **Send Homework Due Reminders** for assignments due in 24 hours.
4. Use **Broadcast to All Parents** for academy-wide announcements.

### E. Send a one-off message

1. **Send tab** (or WhatsApp section below hub).
2. Enter phone/email, pick channel, type message.
3. **Send** (simulated or live) or **WhatsApp Web** to open manual chat.

### F. Review delivery

1. **Event Log** — filter by WhatsApp, email, SMS, or push.
2. Confirm status and timestamp for each message.

---

## Common triggers

| Event | Typical message |
|-------|-----------------|
| Absence marked | Parent notified child was absent |
| Test recorded | Score summary sent to parent |
| Class cancelled | Reschedule note via WhatsApp |
| Invoice overdue | Fee reminder with UPI ID |
| Homework due | Reminder before deadline |

---

## Verify

- [ ] Channel settings saved; WhatsApp shows Ready (simulated or live)
- [ ] At least one automation enabled
- [ ] Test send appears in Event Log
- [ ] Attendance save with "Notify parents" creates a log entry
- [ ] Broadcast message reaches message log

---

## Demo tip

Mark attendance with **Notify parents via WhatsApp** checked, then check **Communication Hub → Event Log**.

---

*Related: Settings (WhatsApp API) · Academy Attendance · Fees reminders.*
