import { readdirSync, existsSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pillarsDir = resolve(__dirname, '../docs/pillars');
const converter = resolve(__dirname, 'md-to-pdf.mjs');

const files = readdirSync(pillarsDir)
  .filter((f) => f.endsWith('.md'))
  .sort();

if (!files.length) {
  console.error('No markdown files in docs/pillars/');
  process.exit(1);
}

console.log(`Generating ${files.length} pillar PDF(s)...\n`);

let failed = 0;
for (const file of files) {
  const mdPath = join(pillarsDir, file);
  const pdfPath = mdPath.replace(/\.md$/i, '.pdf');
  const result = spawnSync(process.execPath, [converter, mdPath, pdfPath], {
    encoding: 'utf8',
    stdio: 'pipe',
  });
  if (result.status === 0 && existsSync(pdfPath)) {
    console.log(`OK  ${file} -> ${file.replace(/\.md$/i, '.pdf')}`);
  } else {
    failed += 1;
    console.error(`FAIL ${file}`);
    if (result.stderr) console.error(result.stderr);
    if (result.stdout) console.error(result.stdout);
  }
}

console.log(failed ? `\n${files.length - failed}/${files.length} succeeded.` : `\nAll ${files.length} PDFs generated in docs/pillars/`);
process.exit(failed ? 1 : 0);
