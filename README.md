# TutorHub — Smart Tutor Management

A modern tutor management website with batch organization, student records, attendance tracking, test marks, WhatsApp parent updates, and an AI assistant.

## Features

| Feature | Description |
|---------|-------------|
| **Batch Management** | Auto-schedule classes from topics with day/time picker |
| **Class Schedule** | Meeting links for every class session |
| **Teachers** | Assign tutors to batches with performance reports |
| **Reports** | Student & teacher performance dashboards |
| **Student Management** | Full student profiles with parent contact details |
| **Attendance Tracking** | Mark present/absent/late and view history & patterns |
| **Tests & Marks** | Record scores, view averages, track performance |
| **WhatsApp Integration** | Send attendance & test updates to parents (API or simulate) |
| **AI Assistant** | Insights, performance analysis, and parent message drafting |

## Quick Start

No install required — open in any browser:

1. Open `index.html` in Chrome, Edge, or Firefox
2. Demo data loads automatically on first visit
3. If upgrading, use **Settings → Reset Demo Data** to load all platform layers
4. All data saved locally in your browser

### Optional: Local server

If you have Python or Node installed:

```bash
# Python
python -m http.server 8080

# Node
npx serve .
```

Then visit `http://localhost:8080`

## Auto-Scheduling (like Epic LMS)

1. Go to **Batches → + New Batch**
2. Enter batch name and assign a teacher
3. In the **Select Days & Time** panel, click days (Mon, Wed, Fri…) and set start/end time
4. Add **course topics** — one per line (each topic becomes one class)
5. Click **Auto-Generate Schedule** — dates and meeting links are created automatically
6. Save — view classes under **Class Schedule** with Join Meeting links

Each class gets a unique Google Meet, Zoom, or Teams link. Edit links or mark classes complete from the batch **Schedule** button.

## WhatsApp Setup (Live Sending)

1. Create a [Meta WhatsApp Business API](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started) account
2. Go to **Settings** in TutorHub
3. Enter your **API Access Token** and **Phone Number ID**
4. Use **Tests & Marks → Send to Parents** or **Attendance → Notify parents**

Without API credentials, messages are **simulated** and logged locally. You can also use **Open in WhatsApp Web** for manual sending.

## AI Assistant

Works in two modes:

- **Built-in AI** (no key): Rule-based insights on attendance, performance, and message drafting
- **OpenAI** (optional): Add your API key in Settings for GPT-powered chat

Try prompts like:
- "Show me insights"
- "How is attendance looking?"
- "Tell me about Priya Patel"
- "Draft message for Aarav about test results"

## Data Export / Import

- **Export**: Click "Export Data" in the top bar (JSON file)
- **Import**: Settings → Import JSON
- **Reset**: Settings → Reset Demo Data

## Project Structure

```
tutor-hub/
├── index.html          # App shell
├── css/app.css         # Styles
├── js/
│   ├── app.js          # Navigation & modals
│   ├── store.js        # Data layer (localStorage)
│   ├── views.js        # Page rendering
│   ├── whatsapp.js     # WhatsApp messaging
│   └── ai.js           # AI assistant
└── README.md
```

## Next Steps (Production)

For a production deployment, consider:

- Backend API (Node.js / Python) with PostgreSQL
- User authentication for multiple tutors
- Real-time WhatsApp via Twilio or Meta Cloud API
- Mobile-responsive PWA for on-the-go attendance

Built with vanilla HTML, CSS, and JavaScript — no build step required.
