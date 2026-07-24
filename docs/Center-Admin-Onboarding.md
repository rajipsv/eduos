# Center Admin Onboarding Guide

**Product:** EduOS (tutor-hub)  
**Audience:** New tuition center owners and managers  
**Goal:** Set up a center from scratch — register, configure settings, link yourself as a teacher (if you teach), create batches, and run class scheduling.

---

## Before you start

| Item | What you need |
|------|----------------|
| **Login URL** | Open the app (local: run `start.bat`, then open the URL shown in the terminal) |
| **Role** | Use the **Center admin** portal tile on the login screen |
| **Password rules** | At least 8 characters (enforced at registration) |
| **Demo reference** | See `docs/qa/accounts.csv` — e.g. `admin@brightminds.demo` / `demo123` |

**Recommended order:** Register → Settings → Teaching profile (if you teach) → Availability slots → Teachers (staff) → Batches → Students → Class Schedule → Fees.

---

## Step 1 — Register your tuition center

### Actions

1. On the login home screen, click **Register your tuition center** (or open the register page directly).
2. Fill in:
   - **Center name** — displayed across the workspace
   - **Your name** — center owner / admin
   - **Email** — becomes your login (must be unique)
   - **Phone** and **City** — optional but recommended
   - **Password** — your admin password
3. Click **Create center**.

### What the system does

- Creates a new **center** (tenant) with status `active` and plan `trial`
- Creates a **center admin** user linked to that center
- Initializes empty center settings
- Logs you in automatically to the **Command Dashboard**

### Verify

- [ ] You land on the **Dashboard** (not the login screen)
- [ ] Top bar shows your name and center name
- [ ] Sidebar shows Academy, CRM, Tutor Success, Settings, etc.
- [ ] **Academy → Batches** shows “No batches yet” (empty workspace)

### Alternative: Platform owner view

If EduOS platform staff onboard you, they log in as **Platform owner** → **All centers** → open your center → **Support view**. That mirrors your admin workspace for troubleshooting. Day-to-day work should still use your own **Center admin** login.

---

## Step 2 — Orient the admin workspace

Key sidebar sections for daily operations:

| Section | Use for |
|---------|---------|
| **Overview → Dashboard** | Today’s stats, upcoming classes, quick links |
| **Education CRM** | Leads, public website |
| **Academy** | Batches, Class Schedule, Teachers, Students, Fees, Attendance, Tests |
| **Tutor Success** | Teacher availability, homework, tutor tools |
| **System → Settings** | Center name, billing, WhatsApp, AI keys, teaching profile |

### Verify

- [ ] You can open each Academy item without errors
- [ ] **Dashboard → Upcoming Classes** is empty until batches exist

---

## Step 3 — Configure center settings

**Path:** **System → Settings**

### 3a — Center details

1. Set **Tutoring center name** (how parents see your brand in messages).
2. Set **Default country code** for phone numbers (e.g. `+91`).
3. Click **Save Settings** (under AI section, or after editing billing — save applies to all settings panels).

### 3b — Billing & invoices (recommended early)

1. **Invoice prefix** — e.g. `INV`
2. **Default due day** — day of month fees are due (1–28)
3. **UPI ID** — shown in fee reminders
4. **Bank details** — optional, for invoice footers

Batch-level fees are set when creating batches; per-student overrides are on the student form.

### 3c — WhatsApp & AI (optional)

- **WhatsApp Business API** — without credentials, messages are simulated locally
- **OpenAI API key** — optional; AI works with rule-based fallback without a key

### 3d — Data storage

Under **Data Management**, confirm storage backend:

- **Neon PostgreSQL** — data synced to server database
- **Browser localStorage** — demo/local mode; run `start.bat` with `DATABASE_URL` for production sync

### Verify

- [ ] Center name saved and reflected in top bar / parent-facing copy
- [ ] Invoice prefix and UPI ID saved
- [ ] Storage backend matches your deployment expectation

---

## Step 4 — Link yourself as a teacher (owner who also teaches)

Many center owners teach their own batches. Use **one admin login** — do not create a separate teacher account for yourself unless you want a second login.

**Path:** **System → Settings → My teaching profile**

### Actions

1. Check **I also teach classes**.
2. Choose **Teacher profile**:
   - **Use my account (your name)** — creates/links a teacher roster entry to your admin user
   - Or pick an existing teacher record if you already added yourself under Teachers
3. Enter **Subjects** (comma-separated), e.g. `Mathematics, Science`.
4. Click **Save teaching profile**.

### Verify

- [ ] Checkbox stays checked after refresh
- [ ] **Academy → Teachers** shows your name with a green **You** badge
- [ ] **Tutor Success** defaults to your linked teacher profile
- [ ] You can assign yourself when creating a batch

### Staff teachers (different from owner)

For tutors who need their **own login**:

1. **Academy → Teachers → + Add Teacher** — add name, email, phone, subjects (roster record).
2. Teacher login accounts are separate users with role `teacher` and a `linkedTeacherId`. In the current MVP, demo accounts are pre-seeded; for new staff, coordinate with platform support or data import until a self-service “invite teacher” flow exists.

---

## Step 5 — Set teacher availability slots

Batches pick **free slots** from a teacher’s availability. Slots already assigned to another batch are hidden to prevent double-booking.

**Path:** **Tutor Success → Schedule tab → Manage slots**

(As admin-with-teaching-profile, Tutor Success opens on **your** teacher. For staff, use Support view or have the teacher set their own slots from the Teacher portal.)

### Actions

1. Click **Manage slots**.
2. Add one or more slots — each slot has:
   - **Days** (e.g. Mon, Wed, Fri)
   - **Start time** and **End time**
3. Example: Slot 1 = Mon/Wed/Fri 4:00–6:00 PM; Slot 2 = Sat 10:00–12:00 PM.
4. Click **Save availability**.

### Verify

- [ ] Slots appear in the Availability panel
- [ ] **Academy → Batches → New Batch** shows your slots when you select yourself as teacher
- [ ] After assigning a slot to Batch A, that slot does **not** appear when creating Batch B for the same teacher

---

## Step 6 — Add teachers (staff roster)

Skip if you are the only teacher and already linked in Step 4.

**Path:** **Academy → Teachers → + Add Teacher**

### Actions

1. Enter name, email, phone, subjects.
2. Save.
3. Have each teacher set availability under **Tutor Success** (teacher login) or set slots while in admin Support view.

### Verify

- [ ] Teacher appears on Teachers list with batch/student counts (zero initially)
- [ ] Teacher can be selected in batch form **Assigned teacher** dropdown
- [ ] Teacher with no slots shows manual day/time fallback in batch form (or prompt to add slots in Tutor Success)

---

## Step 7 — Create a batch and auto-generate schedule

**Path:** **Academy → Batches → + New Batch**

### Actions

1. **Batch name** — e.g. `Grade 10 Mathematics — Evening`
2. **Assigned teacher** — select tutor (yourself or staff)
3. **Capacity**, **Monthly fee (₹)**, **Fee due day**, **Subjects**, **Notes**
4. Under **Class schedule from teacher availability**:
   - Select a **free availability slot** (preferred), **or**
   - If no slots exist, pick days + start/end time manually
5. Set **Course start date** and **Meeting platform** (Google Meet / Zoom / Teams)
6. **Course topics** — one topic per line (one class per topic):
   ```
   Introduction to Algebra
   Linear Equations
   Quadratic Equations
   ```
7. Click **⚡ Auto-Generate Schedule** — preview lists all sessions with dates and meeting links
8. Click **Save Batch**

### Rules enforced by the app

- If the teacher has availability slots, you must pick a slot (or get a validation error)
- A slot already used by another batch cannot be selected again
- Saving syncs the batch to the chosen `availabilitySlotId`

### Verify

- [ ] Batch appears in the list with schedule summary (e.g. Mon/Wed/Fri · 4:00 PM)
- [ ] **Schedule** button on the batch shows all generated sessions
- [ ] **Dashboard → Upcoming Classes** lists the next session
- [ ] **Academy → Class Schedule** shows sessions on the week calendar
- [ ] Creating a second batch for the same teacher does not offer an already-booked slot

---

## Step 8 — Add students

**Path:** **Academy → Students → + Add Student**

### Actions

1. Enter student name, grade, contact email/phone
2. Assign **Batch**
3. Enter **Parent name** and **Parent phone** (used for comms and fee reminders)
4. Optional: override monthly fee on the student record
5. Save

### Optional: CRM enrollment

**Education CRM → Lead pipeline** — convert a lead to a student when they enroll (links CRM to Academy).

### Verify

- [ ] Student appears in Students table with correct batch
- [ ] Batch capacity / student counts update on Dashboard stats
- [ ] **Reports → Student Reports** includes the new student

---

## Step 9 — Manage class schedule (day-to-day)

**Path:** **Academy → Class Schedule**

### Week calendar

- Browse by week; filter by batch
- Click a class for actions

### Per-session actions

| Action | When to use |
|--------|-------------|
| **Join Meeting** | Open live class link |
| **Copy Link** | Share with parents |
| **Reschedule** | Move one session to another date/time |
| **Cancel** | Cancel with optional reason; parents can be notified (WhatsApp if configured) |
| **Mark done** | Mark session completed |
| **Restore / Undo** | Reverse cancel or completion |

### Batch-level schedule edit

**Academy → Batches → Schedule** on a batch — edit meeting links or mark sessions done in bulk preview.

### Verify

- [ ] Rescheduled session shows “Was [old date/time]” note
- [ ] Cancelled sessions move to cancelled filter/tab
- [ ] Completed sessions reflect in attendance and curriculum progress
- [ ] Teacher portal (**Teacher → My schedule**) shows the same sessions for linked teachers

---

## Step 10 — Fees & invoices

**Path:** **Academy → Fees & Invoices**

### Setup (already done in Settings)

- Invoice prefix, default due day, UPI ID

### Per batch / student

- **Monthly fee** and **Fee due day** on batch form
- Per-student override on student form

### Operations

- Generate or review invoices for the billing period
- Send reminders (simulated WhatsApp unless API configured)
- Mark payments received

### Verify

- [ ] Invoice amounts match batch fee × enrolled students (minus overrides)
- [ ] UPI ID appears on reminders
- [ ] **Parent Portal → Fees** tab shows balance for linked parents (family demo: `sharma@family.demo`)

---

## Step 11 — Next steps (after core setup)

| Area | Path | Purpose |
|------|------|---------|
| **Attendance** | Academy → Attendance | Mark who attended each class |
| **Tests & Marks** | Academy → Tests & Marks | Record assessments; feeds reports |
| **Communication Hub** | Communication | Messages to parents/staff |
| **Student Success** | Student Success | Homework, assignments |
| **Tutor Success** | Tutor Success | Homework grading, lesson plans |
| **Reports** | System → Reports | Student and teacher performance |
| **Public Website** | Education CRM → Public Website | Center listing for inquiries |

---

## Master verification checklist

Use this before going live with real students.

### Account & center

- [ ] Center registered; admin can log in via **Center admin** tile
- [ ] Password reset works (**Forgot password** on login)
- [ ] Settings saved: center name, billing, storage backend understood

### People

- [ ] Owner teaching profile linked (if applicable) — **You** badge on Teachers
- [ ] Staff teachers added to roster
- [ ] Availability slots saved for every teacher who runs batches

### Academic operations

- [ ] At least one batch created with topics and generated schedule
- [ ] No double-booked teacher slots across batches
- [ ] Students assigned to batches
- [ ] Class Schedule calendar shows upcoming sessions
- [ ] Meeting links open (Google Meet / Zoom / Teams)

### Business operations

- [ ] Monthly fees set on batches
- [ ] Invoices / fee reminders tested
- [ ] Parent contact numbers on student records

### Optional integrations

- [ ] WhatsApp API configured (or accept simulated mode)
- [ ] OpenAI key added (or accept offline AI)

---

## Common issues

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| No availability slots in batch form | Teacher has no slots | Tutor Success → Schedule → Manage slots |
| All slots show as booked | Every slot assigned to another batch | Free a slot (delete/edit batch) or add a new availability slot |
| “Select a teacher availability slot” error | Teacher selected but no slot/day chosen | Pick a slot or use manual days/times |
| “That slot is already used by …” | Another batch holds the slot | Choose a different slot or reschedule the other batch |
| Teacher cannot see batches | Teacher login not linked to roster | Ensure teacher user has `linkedTeacherId` matching roster id |
| Data lost after browser clear | localStorage mode | Use Neon PostgreSQL via `start.bat` + `DATABASE_URL` |
| Owner wants two logins | Unnecessary for solo owner | Use **I also teach classes** in Settings instead |

---

## Quick reference — navigation map

```
Register → Dashboard
    │
    ├─ Settings ───────────── Center name, billing, teaching profile
    │
    ├─ Tutor Success ──────── Availability slots (Manage slots)
    │
    ├─ Teachers ───────────── Staff roster (+ You badge for owner)
    │
    ├─ Batches ────────────── Create batch → pick slot → topics → Auto-Generate
    │
    ├─ Students ───────────── Enroll into batches
    │
    ├─ Class Schedule ─────── Calendar: cancel / reschedule / mark done
    │
    └─ Fees & Invoices ────── Billing after enrollment
```

---

## Demo walkthrough (5-minute smoke test)

1. Log in as `admin@brightminds.demo` / `demo123` (**Center admin**)
2. **Settings** — confirm teaching profile or enable **I also teach classes**
3. **Tutor Success → Schedule** — review **Manage slots**
4. **Batches** — open an existing batch or create a test batch; confirm slot picker
5. **Class Schedule** — reschedule one session; confirm calendar updates
6. Log in as `anita@tutorhub.com` / `demo123` (**Teacher**) — confirm **My schedule** matches her batches only

---

*Related docs: [EDUOS-WORKFLOW.md](./EDUOS-WORKFLOW.md) · [QA accounts](./qa/accounts.csv)*
