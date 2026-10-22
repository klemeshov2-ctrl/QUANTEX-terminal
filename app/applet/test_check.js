const fs = require('fs');

const code = fs.readFileSync('./src/data/pineScriptGenerators.ts', 'utf8');
const lines = code.split('\n');

lines.forEach((l, i) => {
  // Check for \n inside template literals where it should be \\n for Pine Script
  // E.g. "Text \n Text" or "\\n"
  if (l.includes('\\n') && !l.includes('\\\\n')) {
    console.log(`Line ${i + 1}: ${l.trim()}`);
  }
});
