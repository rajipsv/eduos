import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const htmlPath = path.join(root, 'docs', 'pitch', 'EduOS-Customer-Pitch.html');
const pdfPath = path.join(root, 'docs', 'pitch', 'EduOS-Customer-Pitch.pdf');

if (!fs.existsSync(htmlPath)) {
  console.error('Missing HTML pitch file:', htmlPath);
  process.exit(1);
}

const browser = await puppeteer.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.goto(`file:///${htmlPath.replace(/\\/g, '/')}`, { waitUntil: 'networkidle0', timeout: 60000 });
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  });
  console.log('PDF written to:', pdfPath);
} finally {
  await browser.close();
}
