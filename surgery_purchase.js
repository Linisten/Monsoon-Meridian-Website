import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const filePath = join(__dirname, 'src', 'pages', 'Purchase.jsx');
let lines = fs.readFileSync(filePath, 'utf8').split('\n');

// The error was at line 236: ))
// Let's remove lines 234-236 (absolute indices 233-235)
// and replace with correct closing tags.

// Search for the stray )) segment
const junkIndex = lines.findIndex(l => l.includes('))') && l.includes(')}'));
// Or just look for line 235 specifically in the current file.

console.log('Original lines around 235:');
console.log(lines.slice(230, 240).join('\n'));

// Targeted cleanup
const line235 = lines[234] || '';
const line236 = lines[235] || '';

if (line235.trim() === '))' || line236.trim() === ')}') {
  console.log('Detected junk, stripping...');
  lines.splice(234, 2); // Remove the two stray lines
} else {
  // Fallback: look for the pattern
  const fixedLines = [];
  let found = false;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('))') && lines[i+1]?.includes(')}')) {
        i += 1; // skip them
        found = true;
        continue;
    }
    fixedLines.push(lines[i]);
  }
  if (found) {
    lines = fixedLines;
    console.log('Pattern based cleanup successful');
  }
}

fs.writeFileSync(filePath, lines.join('\n'));
console.log('Purchase.jsx syntax fixed');
