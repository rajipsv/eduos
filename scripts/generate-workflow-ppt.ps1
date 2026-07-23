# Generates EduOS-Workflow.pptx from docs/EDUOS-WORKFLOW.md content
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$outPath = Join-Path $root 'docs\EduOS-Workflow.pptx'

function Get-PptRgb([int]$r, [int]$g, [int]$b) { return $r + ($g -shl 8) + ($b -shl 16) }

$greenDark = Get-PptRgb 27 67 50
$greenMid  = Get-PptRgb 45 106 79
$textDark  = Get-PptRgb 26 46 26
$textMuted = Get-PptRgb 61 79 61
$bgLight   = Get-PptRgb 250 252 251

function Set-SlideBackground($slide, $rgb) {
    $slide.FollowMasterBackground = 0
    $slide.Background.Fill.Visible = -1
    $slide.Background.Fill.ForeColor.RGB = $rgb
    $slide.Background.Fill.Solid()
}

function Add-TextBox($slide, $left, $top, $width, $height, $text, $fontSize, $rgb, [bool]$bold = $false, [int]$align = 1) {
    $box = $slide.Shapes.AddTextbox(1, $left, $top, $width, $height)
    $range = $box.TextFrame.TextRange
    $range.Text = $text
    $range.Font.Size = $fontSize
    $range.Font.Bold = $bold
    $range.Font.Color.RGB = $rgb
    $range.ParagraphFormat.Alignment = $align
    $box.TextFrame.WordWrap = -1
    $box.Line.Visible = 0
    $box.Fill.Visible = 0
}

function Add-BulletSlide($pres, $title, [string[]]$bullets, $subtitle = '', [int]$bodyTop = 130) {
    $slide = $pres.Slides.Add($pres.Slides.Count + 1, 12)
    Set-SlideBackground $slide $bgLight
    Add-TextBox $slide 40 28 640 44 $title 30 $greenDark $true | Out-Null
    if ($subtitle) { Add-TextBox $slide 40 78 640 36 $subtitle 13 $textMuted $false | Out-Null }
    $body = ($bullets | ForEach-Object { "- $_" }) -join "`r"
    Add-TextBox $slide 48 $bodyTop 640 (480 - $bodyTop) $body 16 $textDark $false | Out-Null
}

function Add-TwoColumnSlide($pres, $title, $leftTitle, [string[]]$leftBullets, $rightTitle, [string[]]$rightBullets) {
    $slide = $pres.Slides.Add($pres.Slides.Count + 1, 12)
    Set-SlideBackground $slide $bgLight
    Add-TextBox $slide 40 28 640 44 $title 30 $greenDark $true | Out-Null
    Add-TextBox $slide 40 90 310 24 $leftTitle 16 $greenMid $true | Out-Null
    Add-TextBox $slide 370 90 310 24 $rightTitle 16 $greenMid $true | Out-Null
    $left = ($leftBullets | ForEach-Object { "- $_" }) -join "`r"
    $right = ($rightBullets | ForEach-Object { "- $_" }) -join "`r"
    Add-TextBox $slide 40 118 310 360 $left 14 $textDark $false | Out-Null
    Add-TextBox $slide 370 118 310 360 $right 14 $textDark $false | Out-Null
}

Write-Host 'Opening PowerPoint...'
$ppt = New-Object -ComObject PowerPoint.Application
$ppt.Visible = 1
$pres = $ppt.Presentations.Add()

try {
    # Title
    $s1 = $pres.Slides.Add(1, 12)
    Set-SlideBackground $s1 $greenMid
    Add-TextBox $s1 40 100 640 36 'WORKFLOW AND HIGH-LEVEL DESIGN' 12 (Get-PptRgb 220 235 228) $false | Out-Null
    Add-TextBox $s1 40 140 640 70 'EduOS' 54 (Get-PptRgb 255 255 255) $true | Out-Null
    Add-TextBox $s1 40 220 620 60 'Tutoring operations platform - not an LMS | Multi-tenant MVP | Local-first demo' 18 (Get-PptRgb 240 248 244) $false | Out-Null
    Add-TextBox $s1 40 460 640 30 'Source: docs/EDUOS-WORKFLOW.md | tutor-hub codebase' 11 (Get-PptRgb 200 220 210) $false | Out-Null

    Add-BulletSlide $pres '1. What EduOS is' @(
        'Operating system for tuition centers - everything around teaching',
        'Acquire and enroll students (CRM)',
        'Run batches, schedules, attendance, tests',
        'Message parents and staff; track success signals',
        'Business intelligence and external tool connections',
        'Teaching happens on Zoom, Meet, Khan Academy, etc.',
        'EduOS coordinates logistics and visibility'
    )

    Add-BulletSlide $pres 'Multi-tenant architecture' @(
        'PLATFORM OWNER: onboard centers, monitor usage, support view',
        'Many centers (Center A, B, C...) each isolated by centerId',
        'Per center: Admin, Teachers, Students, Parents',
        'Platform owner can enter support view into one center workspace',
        'New centers register on auth screen and get empty scoped workspace'
    ) 'Data scoped per center; one EduOS instance serves many academies.'

    Add-BulletSlide $pres '2. Design principles' @(
        'Ops-first: CRM, schedule, attendance, comms - not course hosting',
        'Multi-tenant: each center data isolated by centerId',
        'Role-based portals: same app, different nav and permissions',
        'Decisions not dashboards: BI suggests what to do next',
        'Local MVP: localStorage, run via start.bat on port 8888',
        'Deferred: payments / billing (Layer 10 removed)'
    )

    Add-BulletSlide $pres '3. Roles and portals' @(
        'Platform owner -> Platform dashboard | all centers + support view',
        'Center admin -> Command dashboard | full center workspace',
        'Teacher -> Teacher Today | own batches and students only',
        'Student -> Student home | own schedule and homework',
        'Parent -> Parent dashboard | linked children only',
        'Login via portal tile; session in tutorhub_session'
    )

    Add-BulletSlide $pres 'Platform owner support view' @(
        'All centers -> open center -> Support view',
        'Nav switches to center-admin menus; data scoped to that center',
        'Enter center workspace for full ops UI',
        'Back to platform exits support view'
    ) 'Center registration creates center + center admin user instantly.'

    Add-BulletSlide $pres '4. Nine layers (1-5)' @(
        'Layer 1 Education CRM - public site, leads, pipeline, enrollment',
        'Layer 2 Academy OS - batches, schedule, teachers, students, attendance, tests',
        'Layer 3 Communication - WhatsApp, email, SMS, automations',
        'Layer 4 Student Success - journeys, homework, interventions, certificates',
        'Layer 5 Tutor Success - lesson plans, homework review, performance, PD'
    ) 'Each layer maps to center admin sidebar; teachers/parents see subsets.'

    Add-BulletSlide $pres '4. Nine layers (6-9)' @(
        'Layer 6 Parent Experience - dashboard, progress, messages, preferences',
        'Layer 7 AI Assistants - rule-based or optional GPT insights',
        'Layer 8 Business Intelligence - KPIs, trends, owner decisions',
        'Layer 9 Extensions and Partners - Zoom, calendar, templates, partners'
    )

    Add-BulletSlide $pres '5.1 Workflow: Lead to student' @(
        'Sources: public website, walk-in, WhatsApp, ads -> CRM lead',
        'Pipeline: Lead > Inquiry > Demo > Counseling > Admission > Payment > Batch > Student',
        'Public Website form writes directly to CRM',
        'CRM tabs: Pipeline, All leads, Follow-ups',
        'Log activities, schedule demos, move stages, WhatsApp follow-up',
        'Enroll converts lead to student (pick batch) -> Layer 2 batch + schedule'
    )

    Add-BulletSlide $pres '5.2 Workflow: Daily academy ops (setup)' @(
        'Add teachers',
        'Create batches and assign teacher',
        'Pick weekdays + start/end time',
        'Enter topics (one topic = one class session)',
        'Auto-generate schedule -> dated sessions with Meet/Zoom/Teams links'
    ) 'Setup once per batch/term.'

    Add-BulletSlide $pres '5.2 Workflow: Daily academy ops (weekly)' @(
        'Class schedule with meeting links',
        'Mark attendance per batch/date (present, absent, late)',
        'Optional parent WhatsApp on attendance',
        'Record tests and marks -> averages and reports',
        'Mark done on completed classes'
    )

    Add-TwoColumnSlide $pres '5.3 Homework permissions' 'Staff can' @(
        'Create assignment (center admin, teacher)',
        'Issue certificate (center admin, teacher)',
        'Add feedback (center admin, teacher)',
        'Student Success: overview, journey, interventions',
        'Tutor Success: lesson plans, homework review, PD'
    ) 'Family can' @(
        'Parent: view homework read-only, mark submitted',
        'Student: submit homework',
        'No admin toolbar on parent login',
        'Homework nav shows read-only list for parents'
    )

    Add-BulletSlide $pres '5.4 Communication (Layer 3)' @(
        'Channels: WhatsApp, email, SMS, push (simulated in demo)',
        'Templates and automations: absence, test results, homework due, reminders',
        'Comm Hub: broadcasts, settings, message log',
        'Quick Message in top bar jumps to comm hub',
        'WhatsApp: simulate mode or live Meta API via Settings'
    )

    Add-BulletSlide $pres '5.5 Parent experience (Layer 6)' @(
        'Home: success score, next class, activity, contact teacher',
        'Progress: strengths, skills, test history',
        'Homework: assignments and status',
        'Attendance: history and rate',
        'Feedback: teacher notes | Messages: center thread',
        'Settings: notification preferences',
        'Request progress summary; mark homework submitted (not grading)'
    )

    Add-BulletSlide $pres '5.6 Intelligence and AI (Layers 7-8)' @(
        'BI: decisions feed - at-risk students, follow-ups, capacity',
        'KPIs, trends, predictions, lead analytics',
        'Action-oriented cards - not static reports only',
        'AI: role-aware chat (owner, tutor, parent, student)',
        'Rule-based default; optional OpenAI key in Settings',
        'Drafts parent messages from attendance/test data'
    )

    Add-BulletSlide $pres '5.7 Extensions (Layer 9)' @(
        'Not a content marketplace',
        'Connections: Zoom, Google Calendar, Twilio, etc.',
        'Templates: ops message templates',
        'Partners: partner service catalog',
        'Teaching content stays on external platforms'
    )

    Add-BulletSlide $pres '6. End-to-end journey (new center)' @(
        'Platform owner registers center on platform',
        'Center admin logs in, configures Settings',
        'Public site + CRM go live',
        'Create batches, auto-generate schedule',
        'Teacher accounts linked to roster',
        'Leads convert to students',
        'Teachers mark attendance, assign homework',
        'Automations notify parents; parent portal active',
        'Owner uses BI decisions and reports'
    )

    Add-BulletSlide $pres '7. Technical architecture' @(
        'index.html + js/app.js (auth gate, nav, modals)',
        'auth.js / auth-views.js - login, register, support view',
        'portals.js - role nav and access control',
        'store.js - localStorage v5, multi-tenant data',
        'views.js - dashboard, CRM shell, academy pages',
        'layer-views.js - layers 3-9 + public site',
        'platform.js, communication.js, intelligence.js, ai.js'
    ) 'Vanilla HTML/CSS/JS - no build step.' 120

    Add-BulletSlide $pres '7. Data model (high level)' @(
        'centers[] - tenant root (platform scope)',
        'users[] - roles, linked teacher/student IDs',
        'centerSettings{} - per-center Settings',
        'batches, students, teachers, leads - centerId scoped',
        'attendance, tests, messages - centerId scoped',
        'Platform extensions: assignments, marketplace, etc.',
        'Keys: tutorhub_session | tutorhub_data_v5'
    )

    Add-BulletSlide $pres '8. Demo accounts (password: demo123)' @(
        'Platform owner: owner@eduos.app',
        'Center admin: admin@brightminds.demo',
        'Teacher: anita@tutorhub.com or vikram@tutorhub.com',
        'Student: aarav@email.com',
        'Parent: rajesh@email.com',
        'Centers: Bright Minds Academy (full) | Excel Tutors Pune (empty)',
        'Reset: Settings > Reset Demo Data'
    ) 'Run start.bat then http://127.0.0.1:8888 - not file:// index.html'

    Add-BulletSlide $pres '9. Permission summary' @(
        'Platform owner -> all centers + support view into one center',
        'Center admin -> all layers in center workspace',
        'Teacher -> scoped batches, students, homework tools',
        'Student -> schedule + homework submit',
        'Parent -> view + message + mark homework submitted',
        'Staff manage; family consume'
    )

    Add-BulletSlide $pres '10. Out of scope (current MVP)' @(
        'Payment collection and invoicing',
        'Hosting course videos or worksheet libraries',
        'Production backend / real multi-user sync',
        'Native mobile apps (responsive web only)',
        'Full API enforcement (keys and webhooks are demo UI)'
    )

    Add-BulletSlide $pres '11. Suggested reading order' @(
        '1 Center admin: Dashboard -> command center',
        '2 CRM: follow one lead to enrollment',
        '3 Batches: auto-schedule -> Class Schedule',
        '4 Attendance + Tests -> Communication Hub',
        '5 Teacher: Today -> attendance -> homework',
        '6 Parent: dashboard -> homework (read-only)',
        '7 Platform owner: all centers -> support view'
    )

    if (Test-Path $outPath) { Remove-Item $outPath -Force }
    $pres.SaveAs($outPath, 24)
    Write-Host "Created: $outPath"
    Write-Host "Slides: $($pres.Slides.Count)"
}
finally {
    if ($pres) { $pres.Close() | Out-Null }
    $ppt.Quit() | Out-Null
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($ppt) | Out-Null
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
}
