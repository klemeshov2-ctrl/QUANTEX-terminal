const fs = require('fs');

const code = fs.readFileSync('./src/data/pineScriptGenerators.ts', 'utf8');
const lines = code.split('\n');

lines.forEach((l, i) => {
  if (l.includes('\\n') && !l.includes('\\\\n')) {
    console.log(`Line ${i + 1}: ${l.trim()}`);
  }
});
