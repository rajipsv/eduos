# Generates EduOS customer pitch PowerPoint (.pptx)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$outPath = Join-Path $root 'docs\pitch\EduOS-Customer-Pitch.pptx'

function Get-PptRgb([int]$r, [int]$g, [int]$b) {
    return $r + ($g -shl 8) + ($b -shl 16)
}

$greenDark  = Get-PptRgb 27 67 50
$greenMid   = Get-PptRgb 45 106 79
$textDark   = Get-PptRgb 26 46 26
$textMuted  = Get-PptRgb 61 79 61

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
    return $box
}

function Add-BulletSlide($pres, $title, [string[]]$bullets, $subtitle = '') {
    $slide = $pres.Slides.Add($pres.Slides.Count + 1, 12)
    Set-SlideBackground $slide (Get-PptRgb 250 252 251)
    Add-TextBox $slide 40 28 640 44 $title 32 $greenDark $true | Out-Null
    if ($subtitle) {
        Add-TextBox $slide 40 78 640 36 $subtitle 14 $textMuted $false | Out-Null
    }
    $body = ($bullets | ForEach-Object { "- $_" }) -join "`r"
    Add-TextBox $slide 48 130 640 360 $body 18 $textDark $false | Out-Null
}

Write-Host 'Opening PowerPoint...'
$ppt = New-Object -ComObject PowerPoint.Application
$ppt.Visible = 1
$pres = $ppt.Presentations.Add()

try {
    $s1 = $pres.Slides.Add(1, 12)
    Set-SlideBackground $s1 $greenMid
    Add-TextBox $s1 40 80 640 36 'TUITION CENTER OPERATIONS PLATFORM' 11 (Get-PptRgb 220 235 228) $false | Out-Null
    Add-TextBox $s1 40 130 640 90 'EduOS' 60 (Get-PptRgb 255 255 255) $true | Out-Null
    Add-TextBox $s1 40 230 580 80 'The operating system for education businesses. Acquire students, run operations, keep parents informed, and grow with confidence.' 20 (Get-PptRgb 240 248 244) $false | Out-Null
    Add-TextBox $s1 40 480 640 30 'Product overview for tuition centers and coaching institutes | Confidential | 2026' 11 (Get-PptRgb 200 220 210) $false | Out-Null

    Add-BulletSlide $pres 'The problem tuition centers face' @(
        'Leads lost in notebooks and WhatsApp threads',
        'Schedules in Excel - meeting links copied manually',
        'Parents call daily for attendance and homework updates',
        'Owners guess instead of deciding from data',
        'Generic LMS tools want to host content, not run your business'
    ) 'Most academies stitch together spreadsheets, chat groups, and disconnected tools.'

    $s3 = $pres.Slides.Add($pres.Slides.Count + 1, 12)
    Set-SlideBackground $s3 (Get-PptRgb 250 252 251)
    Add-TextBox $s3 40 28 640 44 'Fragmented vs unified operations' 32 $greenDark $true | Out-Null
    $leftCol = @(
        'Today (fragmented)', '', '- Manual lead tracking', '- Excel schedules',
        '- Reactive parent calls', '- No decision support', '- LMS is not business ops'
    ) -join "`r"
    $rightCol = @(
        'With EduOS', '', '- CRM pipeline to enrollment', '- Auto-schedule and meeting links',
        '- WhatsApp and email automations', '- BI: what to do today', '- Works with Zoom and Meet'
    ) -join "`r"
    Add-TextBox $s3 40 90 310 280 $leftCol 16 (Get-PptRgb 120 40 40) $false | Out-Null
    Add-TextBox $s3 370 90 310 280 $rightCol 16 $greenMid $false | Out-Null

    $s4 = $pres.Slides.Add($pres.Slides.Count + 1, 12)
    Set-SlideBackground $s4 (Get-PptRgb 250 252 251)
    Add-TextBox $s4 40 28 640 44 'Ops platform - not an LMS' 32 $greenDark $true | Out-Null
    Add-TextBox $s4 40 90 300 200 'EduOS handles operations' 18 $greenMid $true | Out-Null
    Add-TextBox $s4 40 118 300 180 'CRM, batches, schedules, attendance, tests, homework tracking, parent communication, tutor performance, and business intelligence.' 14 $textDark $false | Out-Null
    Add-TextBox $s4 370 90 300 200 'Tutors keep teaching their way' 18 $greenMid $true | Out-Null
    Add-TextBox $s4 370 118 300 180 'EduOS does not replace Zoom, Google Meet, or your curriculum platforms. It coordinates logistics and gives everyone visibility.' 14 $textDark $false | Out-Null
    Add-TextBox $s4 40 340 640 100 '9 pillars | 5 role portals | Multi-center ready | No content hosting required' 16 $greenMid $true 2 | Out-Null

    Add-BulletSlide $pres 'Nine pillars - part 1' @(
        '1 Education CRM - public site, leads, demos, enrollment',
        '2 Academy OS - batches, schedule, teachers, attendance, tests',
        '3 Communication - WhatsApp, email, SMS, automations',
        '4 Student Success - journeys, homework, interventions, certificates',
        '5 Tutor Success - lesson plans, homework review, performance, PD'
    ) 'Every capability a tuition center needs in one product.'

    Add-BulletSlide $pres 'Nine pillars - part 2' @(
        '6 Parent Experience - progress, homework, attendance, messages',
        '7 AI Assistants - insights, drafts, role-aware guidance',
        '8 Business Intelligence - KPIs, trends, daily decisions',
        '9 Extensions and Partners - Zoom, calendar, Twilio connections'
    )

    Add-BulletSlide $pres 'Built for every stakeholder' @(
        'Center owner - full dashboard, CRM, BI, all pillars',
        'Teacher - today classes, attendance, homework, my students',
        'Parent - child progress, homework status, messages (read-only)',
        'Student - schedule and homework submit',
        'Platform operator - all centers, onboarding, support view'
    )

    $s8 = $pres.Slides.Add($pres.Slides.Count + 1, 12)
    Set-SlideBackground $s8 (Get-PptRgb 250 252 251)
    Add-TextBox $s8 40 28 640 44 'Workflow: inquiry to enrolled student' 30 $greenDark $true | Out-Null
    Add-TextBox $s8 40 95 640 40 'Website > CRM > Demo > Counseling > Batch > Enrolled' 17 $greenMid $true 2 | Out-Null
    Add-TextBox $s8 48 150 640 300 (@(
        '- Capture leads from website, WhatsApp, walk-ins, ads',
        '- Visual pipeline with follow-up reminders',
        '- Schedule demo classes from lead detail',
        '- One-click enroll into a batch',
        '- Parent automations from day one'
    ) -join "`r") 18 $textDark $false | Out-Null

    $s9 = $pres.Slides.Add($pres.Slides.Count + 1, 12)
    Set-SlideBackground $s9 (Get-PptRgb 250 252 251)
    Add-TextBox $s9 40 28 640 44 'Workflow: running classes every week' 30 $greenDark $true | Out-Null
    Add-TextBox $s9 40 95 640 40 'Batch > Auto-schedule > Meeting links > Attendance > Notify parents' 17 $greenMid $true 2 | Out-Null
    Add-TextBox $s9 48 150 640 300 (@(
        '- Pick days, times, topics - one topic = one class',
        '- Auto-generate schedule with Meet, Zoom, Teams links',
        '- Teachers mark attendance on any device',
        '- Record tests - averages roll up automatically',
        '- Event-driven WhatsApp and email to parents'
    ) -join "`r") 18 $textDark $false | Out-Null

    $s10 = $pres.Slides.Add($pres.Slides.Count + 1, 12)
    Set-SlideBackground $s10 (Get-PptRgb 250 252 251)
    Add-TextBox $s10 40 28 640 44 'Workflow: homework and parent visibility' 30 $greenDark $true | Out-Null
    Add-TextBox $s10 40 95 300 220 'Staff (admin and teachers)' 18 $greenMid $true | Out-Null
    Add-TextBox $s10 40 125 300 200 'Create assignments, issue certificates, post feedback, review submissions. Interventions when students fall behind.' 14 $textDark $false | Out-Null
    Add-TextBox $s10 370 95 300 220 'Parents and students' 18 $greenMid $true | Out-Null
    Add-TextBox $s10 370 125 300 200 'Parents see homework and progress without admin clutter. Students submit work; parents stay informed via portal and WhatsApp.' 14 $textDark $false | Out-Null

    Add-BulletSlide $pres 'Multi-center ready' @(
        'Platform dashboard - all tuition centers on one EduOS instance',
        'Support view - help a center without sharing passwords',
        'Self-serve registration - new center gets full workspace instantly',
        'Isolated data per center - teachers, students, parents scoped',
        'Suspend and monitor centers from platform owner console'
    ) 'Built for franchise operators and independent academies alike.'

    Add-BulletSlide $pres 'Why centers choose EduOS' @(
        'Lead-to-enrollment CRM - built in, not bolted on',
        'Topic-based auto scheduling - not manual calendar entry',
        'Parent WhatsApp automations - event-driven, not manual blasts',
        'Teacher workspace - ops-focused, not content-focused',
        'Decision engine - action cards, not static reports only',
        'Native multi-center - scale as a platform business'
    )

    $s13 = $pres.Slides.Add($pres.Slides.Count + 1, 12)
    Set-SlideBackground $s13 $greenMid
    Add-TextBox $s13 40 60 640 50 'See EduOS in action' 36 (Get-PptRgb 255 255 255) $true | Out-Null
    $cta = @(
        'Live demo - every role in one session:', '',
        '- Center owner: CRM, batch, schedule, BI decisions',
        '- Teacher: classes, attendance, homework',
        '- Parent: progress portal and automated updates',
        '- Platform operator: multi-center dashboard', '',
        'Contact: hello@eduos.app',
        'Demo: run start.bat then open http://127.0.0.1:8888'
    ) -join "`r"
    Add-TextBox $s13 48 130 640 260 $cta 18 (Get-PptRgb 240 248 244) $false | Out-Null

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
