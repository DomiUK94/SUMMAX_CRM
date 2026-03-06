const fs = require('fs');
const path = require('path');

const root = path.resolve(process.cwd(), 'src');
const files = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
      continue;
    }
    if (/\.(ts|tsx|css)$/.test(entry.name)) files.push(full);
  }
}

walk(root);

const badPatterns = [
  /Ã/g,
  /�/g,
  /acci\?n/g,
  /d\?as/g,
  /Compa\?\?a/g,
  /Cr\?tico/g,
  /A\?adir/g,
  /todav\?a/g,
  /creaciÃ³n/g,
  /aÃ±adida/g,
  /B\?\?squeda/g,
  /Configuraci\?\?n/g,
  /Anal\?\?tica/g,
  /financiaci\?\?n/g,
  /NavegaciÃ³n/g
];

const findings = [];
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (badPatterns.some((pattern) => pattern.test(line))) {
      findings.push(`${path.relative(process.cwd(), file)}:${index + 1}:${line.trim()}`);
    }
  });
}

if (findings.length) {
  console.error('Found potential mojibake or broken accents:');
  for (const finding of findings) console.error(finding);
  process.exit(1);
}

console.log('No mojibake patterns detected.');
