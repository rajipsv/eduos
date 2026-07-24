# Pillar 7 — AI Assistants

**Product:** EduOS · **Layer:** 7 · **Sidebar:** AI Assistants

---

## Purpose

AI Assistants provide **role-aware help** for owners, tutors, parents, and students: chat Q&A, one-click actions (lesson plans, parent messages, quizzes), and auto insights from your center data.

Works **offline with rule-based AI** by default; add an OpenAI key in Settings for GPT-powered responses.

---

## Who uses it

| Role | Typical use |
|------|-------------|
| Center admin | Operations chat, insights, owner actions |
| Teacher | Lesson plans, quizzes, homework ideas |
| Parent | Explain scores, attendance, how to help at home |
| Student | Topic explanations and study help |

All roles access **AI Assistants** from the sidebar when logged in with appropriate portal.

---

## Modules & functionalities

**Path:** AI Assistants

**Main tabs:**

| Tab | Function |
|-----|----------|
| Chat | Conversational AI with role switcher (Owner / Tutor / Parent / Student) |
| Actions | One-click generators — lesson plan, parent message, quiz, decisions, dropout risk, study plan |
| Insights | Auto-generated alerts from attendance, tests, capacity |
| History | Past conversations — filter by role, clear history |

**Chat roles:**

| Role | Assistant name | Example prompts |
|------|----------------|-----------------|
| Academy Owner | AI Academy Manager | "Show me today's problems", "How is attendance?" |
| Tutor | AI Lesson Assistant | "Generate lesson plan for tomorrow", "Create a quiz on algebra" |
| Parent | AI Parent Assistant | "Why did my child score lower?", "How can I help at home?" |
| Student | AI Tutor | "Explain Newton's Laws", "Help with quadratic equations" |

**Mode badge:** Shows **GPT enabled** or **Rule-based** depending on Settings.

---

## How to use — step by step

### A. Enable GPT (optional)

1. **Settings → AI Assistant (OpenAI)**.
2. Paste OpenAI API key (`sk-...`) → **Save Settings**.
3. Return to AI Assistants — badge should show **GPT enabled**.

### B. Chat as academy owner

1. **AI Assistants → Chat tab**.
2. Ensure **Academy Owner** role tab is selected.
3. Click a suggestion chip or type a question → **Send**.
4. Review answer in chat panel; check **Auto Insights** panel on the right.

### C. Run one-click actions

1. **Actions tab**.
2. Select role (Owner, Tutor, Parent, Student).
3. Optionally pick a student and topic.
4. Click **Run** on an action card (e.g. Lesson plan, Parent message, Quiz).
5. Read result in **Action Result** panel below.

### D. Refresh insights

1. **Insights tab** (or Auto Insights in Chat).
2. Click **Refresh** after new attendance/test data.
3. Insights surface at-risk students, low attendance, capacity issues.

### E. Review history

1. **History tab** — filter by role.
2. Review past Q&A for audit or reuse.
3. **Clear History** when resetting demo data.

---

## What AI can and cannot do

| Can do | Cannot do |
|--------|-----------|
| Draft lesson plans and parent messages | Host live video classes |
| Summarize attendance and test trends | Replace fee collection (see Academy Fees) |
| Suggest interventions and quizzes | Auto-enroll CRM leads without your action |
| Explain topics to students | Send WhatsApp without Communication Hub |

---

## Verify

- [ ] Chat responds to owner prompt (rule-based or GPT)
- [ ] Actions tab generates a lesson plan or quiz result
- [ ] Insights refresh after data changes
- [ ] History records the conversation
- [ ] With OpenAI key saved, mode badge shows GPT enabled

---

## Demo tip

Without API key: ask **"Show insights"** or **"How is attendance?"** — rule-based engine uses live center data.

---

*Related: Settings (OpenAI key) · Pillar 8 (Business Intelligence) for structured decisions.*
