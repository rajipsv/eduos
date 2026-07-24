import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inlineMarkdown(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

function parseTable(lines) {
  const rows = lines.filter((l) => l.trim().startsWith('|'));
  if (rows.length < 2) return null;
  const parseRow = (line) =>
    line
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((c) => c.trim());
  const header = parseRow(rows[0]);
  const bodyRows = rows.slice(2).map(parseRow);
  const thead = `<thead><tr>${header.map((c) => `<th>${inlineMarkdown(c)}</th>`).join('')}</tr></thead>`;
  const tbody = `<tbody>${bodyRows
    .map((r) => `<tr>${r.map((c) => `<td>${inlineMarkdown(c)}</td>`).join('')}</tr>`)
    .join('')}</tbody>`;
  return `<table>${thead}${tbody}</table>`;
}

function markdownToHtml(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('```')) {
      const codeLines = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(escapeHtml(lines[i]));
        i += 1;
      }
      out.push(`<pre><code>${codeLines.join('\n')}</code></pre>`);
      i += 1;
      continue;
    }

    if (line.trim().startsWith('|')) {
      const tableLines = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i]);
        i += 1;
      }
      const table = parseTable(tableLines);
      if (table) out.push(table);
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      out.push('<hr>');
      i += 1;
      continue;
    }

    if (line.startsWith('# ')) {
      out.push(`<h1>${inlineMarkdown(line.slice(2).trim())}</h1>`);
      i += 1;
      continue;
    }
    if (line.startsWith('## ')) {
      out.push(`<section class="break"><h2>${inlineMarkdown(line.slice(3).trim())}</h2>`);
      i += 1;
      continue;
    }
    if (line.startsWith('### ')) {
      out.push(`<h3>${inlineMarkdown(line.slice(4).trim())}</h3>`);
      i += 1;
      continue;
    }

    if (/^[-*] /.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*] /.test(lines[i])) {
        items.push(`<li>${inlineMarkdown(lines[i].replace(/^[-*] /, ''))}</li>`);
        i += 1;
      }
      out.push(`<ul>${items.join('')}</ul>`);
      continue;
    }

    if (/^\d+\. /.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(`<li>${inlineMarkdown(lines[i].replace(/^\d+\. /, ''))}</li>`);
        i += 1;
      }
      out.push(`<ol>${items.join('')}</ol>`);
      continue;
    }

    if (/^- \[ \] /.test(line)) {
      const items = [];
      while (i < lines.length && /^- \[ \] /.test(lines[i])) {
        items.push(`<li class="check">${inlineMarkdown(lines[i].replace(/^- \[ \] /, ''))}</li>`);
        i += 1;
      }
      out.push(`<ul class="checklist">${items.join('')}</ul>`);
      continue;
    }

    if (line.trim() === '') {
      i += 1;
      continue;
    }

    if (line.startsWith('*') && line.endsWith('*') && !line.startsWith('**')) {
      out.push(`<p class="muted"><em>${inlineMarkdown(line.slice(1, -1))}</em></p>`);
      i += 1;
      continue;
    }

    out.push(`<p>${inlineMarkdown(line)}</p>`);
    i += 1;
  }

  return out.join('\n');
}

function wrapHtml(title, body) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', system-ui, sans-serif;
      color: #1a2e1a;
      line-height: 1.55;
      font-size: 10pt;
      margin: 0;
      padding: 0 4mm;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .cover {
      min-height: 240mm;
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 18mm 12mm;
      background: linear-gradient(145deg, #1b4332, #2d6a4f 55%, #40916c);
      color: white;
      page-break-after: always;
      margin: -4mm -4mm 0;
    }
    .cover .badge {
      font-size: 9pt;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      opacity: 0.85;
      margin-bottom: 16px;
    }
    .cover h1 {
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 32pt;
      font-weight: 400;
      margin: 0 0 12px;
    }
    .cover p { font-size: 11pt; opacity: 0.92; max-width: 520px; margin: 0 0 8px; }
    .cover .meta { margin-top: 32px; font-size: 9pt; opacity: 0.75; }
    section { padding: 4mm 0; page-break-inside: avoid; }
    section.break { page-break-before: always; padding-top: 0; }
    section.break:first-of-type { page-break-before: auto; }
    h1 { font-size: 22pt; color: #1b4332; margin: 0 0 12px; }
    h2 {
      font-family: Georgia, serif;
      font-size: 16pt;
      color: #1b4332;
      margin: 0 0 10px;
      padding-bottom: 6px;
      border-bottom: 2px solid #40916c;
    }
    h3 {
      font-size: 10pt;
      font-weight: 700;
      color: #2d6a4f;
      margin: 14px 0 6px;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    p, li { color: #3d4f3d; margin: 0 0 6px; }
    ul, ol { margin: 6px 0 10px 18px; padding: 0; }
    ul.checklist { list-style: none; margin-left: 0; padding-left: 0; }
    ul.checklist li.check::before { content: "☐ "; color: #2d6a4f; font-weight: 700; }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9pt;
      margin: 10px 0 14px;
    }
    th, td {
      border: 1px solid #dde8e0;
      padding: 7px 9px;
      text-align: left;
      vertical-align: top;
    }
    th { background: #2d6a4f; color: white; font-weight: 600; }
    tr:nth-child(even) td { background: #f4f9f6; }
    code {
      font-family: Consolas, 'Courier New', monospace;
      font-size: 0.9em;
      background: #eef5f0;
      padding: 1px 4px;
      border-radius: 3px;
    }
    pre {
      background: #1b4332;
      color: #e8f5e9;
      padding: 12px 14px;
      border-radius: 8px;
      font-size: 8.5pt;
      overflow-x: auto;
      margin: 10px 0 14px;
      white-space: pre-wrap;
    }
    pre code { background: none; color: inherit; padding: 0; }
    hr { border: none; border-top: 1px solid #dde8e0; margin: 14px 0; }
    a { color: #2d6a4f; }
    .muted { font-size: 9pt; color: #5a6b5a; }
  </style>
</head>
<body>
  <div class="cover">
    <div class="badge">EduOS Operations Guide</div>
    <h1>${escapeHtml(title)}</h1>
    <p>Step-by-step setup for new tuition center administrators — register, teaching profile, batches, and class scheduling.</p>
    <div class="meta">Generated ${new Date().toISOString().slice(0, 10)} · tutor-hub / EduOS</div>
  </div>
  ${body}
</body>
</html>`;
}

function findBrowser() {
  const candidates = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ];
  return candidates.find((p) => existsSync(p)) || null;
}

function printToPdf(htmlPath, pdfPath) {
  const browser = findBrowser();
  if (!browser) throw new Error('Chrome or Edge not found for PDF export');

  const fileUrl = `file:///${htmlPath.replace(/\\/g, '/')}`;
  const result = spawnSync(
    browser,
    ['--headless', '--disable-gpu', `--print-to-pdf=${pdfPath}`, fileUrl],
    { encoding: 'utf8', timeout: 60000 },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `Browser exited with code ${result.status}`);
  }
  if (!existsSync(pdfPath)) throw new Error(`PDF was not created at ${pdfPath}`);
}

const input = resolve(process.argv[2] || join(__dirname, '../docs/Center-Admin-Onboarding.md'));
const pdfOut = resolve(process.argv[3] || input.replace(/\.md$/i, '.pdf'));
const htmlOut = pdfOut.replace(/\.pdf$/i, '.html');

const md = readFileSync(input, 'utf8');
const titleMatch = md.match(/^#\s+(.+)$/m);
const title = titleMatch ? titleMatch[1].trim() : 'Document';
const body = markdownToHtml(md);
const html = wrapHtml(title, body);

writeFileSync(htmlOut, html, 'utf8');
printToPdf(htmlOut, pdfOut);

console.log(`HTML: ${htmlOut}`);
console.log(`PDF:  ${pdfOut}`);
