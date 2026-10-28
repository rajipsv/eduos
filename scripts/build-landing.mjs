// Writes the public landing page into index.html so it can be read without JavaScript
// (search engines, link previews, slow phones). Run after editing js/home-landing.js:
//   npm run build:landing
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderLandingPage, STATIC_MARKETPLACE_PLACEHOLDER } from '../js/home-landing.js';

export const INDEX_PATH = fileURLToPath(new URL('../index.html', import.meta.url));
const START = /<!-- landing:start[^>]*-->/;
const END = '<!-- landing:end -->';

/** index.html with the landing block replaced by freshly rendered markup. */
export function buildIndexHtml(html) {
  const start = html.match(START);
  const end = html.indexOf(END);
  if (!start || end < 0) throw new Error('index.html is missing the landing:start / landing:end markers');
  const before = html.slice(0, start.index + start[0].length);
  // Keep the file's line endings (Windows checkouts may use CRLF).
  const eol = html.includes('\r\n') ? '\r\n' : '\n';
  const landing = renderLandingPage(STATIC_MARKETPLACE_PLACEHOLDER).trim().replace(/\r?\n/g, eol);
  return `${before}${eol}${landing}${eol}${html.slice(end)}`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const html = readFileSync(INDEX_PATH, 'utf8');
  const next = buildIndexHtml(html);
  if (next === html) console.log('index.html landing is up to date.');
  else {
    writeFileSync(INDEX_PATH, next);
    console.log('index.html landing updated.');
  }
}
