# Pillar 6 — Parent Experience

**Product:** EduOS · **Layer:** 6 · **Sidebar:** Parent Portal

---

## Purpose

The Parent Experience Portal gives guardians **real-time visibility** into their child's classes, progress, homework, attendance, fees, and messages — without calling the center for every update.

---

## Who uses it

| Role | Access |
|------|--------|
| Parent | Parent Portal dashboard and tabs |
| Center admin | Preview parent view (same UI, admin context) |
| Family account | One login — switch **Parent view** / **Student view** in top bar |

**Demo family login:** `sharma@family.demo` / `demo123`

---

## Modules & functionalities

**Path:** Parent Portal (or Parent view after family login)

**Child selector:** Dropdown to switch between linked children.

**Tabs:**

| Tab | Content |
|-----|---------|
| Home | Success score, next class, recent activity, contact teacher |
| Progress | Strengths, skills breakdown, test history chart |
| Homework | Assignments, due dates, status — parent can mark submitted |
| Attendance | History table and attendance rate |
| Fees | Outstanding balance, invoices, report payment (UPI) |
| Feedback | Teacher notes from center |
| Messages | Thread with center / comm hub |
| Settings | Notification preferences (email, WhatsApp, SMS toggles) |

**Actions on Home:**

- **Request Progress Summary** — triggers summary generation/notification

---

## How to use — step by step (parent)

### A. Log in and select child

1. Choose **Family** or **Parent** portal tile (or family login above).
2. If multiple children, use **Viewing as parent of** dropdown.

### B. Check upcoming class

1. **Home tab** — see next class date, time, topic, **Join** link.
2. Review success score and recent activity feed.

### C. Track progress

1. **Progress tab** — skills by subject with progress bars.
2. Review test history and strengths list.

### D. Homework

1. **Homework tab** — list of assignments with due dates.
2. When child completes work offline, parent clicks **Mark submitted** (confirmation, not grading).
3. View grades after teacher grades in Tutor Success.

### E. Attendance & fees

1. **Attendance tab** — see present/absent/late history and overall rate.
2. **Fees tab** — view invoice amount, due date, UPI payment instructions.
3. After paying offline, **Report payment** — admin confirms in Fees & Invoices.

### F. Messages & preferences

1. **Messages tab** — read center announcements and replies.
2. **Settings tab** — toggle notification channels → **Save Preferences**.

---

## How center admin supports parents

1. Ensure student records have correct **parent name** and **parent phone**.
2. Keep class schedule and meeting links updated in Academy.
3. Record attendance and tests so parent tabs stay accurate.
4. Configure UPI ID in **Settings → Billing** for fee tab.
5. Respond to messages in **Communication Hub**.

---

## Verify

- [ ] Parent login shows linked child(ren) only
- [ ] Home displays next scheduled class with join link
- [ ] Homework list matches assignments created in Student Success
- [ ] Fees tab shows current month invoice and UPI ID
- [ ] Report payment flows to admin **Confirm payment**
- [ ] Notification preferences save on Settings tab

---

## Demo tip

Log in as `sharma@family.demo` → switch Parent view → walk Home → Homework → Fees.

---

*Related: Pillar 2 (Fees) · Pillar 4 (Homework) · Pillar 3 (Messages).*
