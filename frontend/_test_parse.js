const esp = require('espree');
const fs = require('fs');
const code = fs.readFileSync('src/pages/teacher/ActivityEditor.jsx', 'utf8');
const lines = code.split('\n');

// Binary search for the problematic line
let lo = 1, hi = lines.length;
while (lo < hi) {
  const mid = Math.floor((lo + hi) / 2);
  const partial = lines.slice(0, mid).join('\n');
  try {
    esp.parse(partial + '\nfunction _dummy(){}', { ecmaVersion: 2020, sourceType: 'module', ecmaFeatures: { jsx: true } });
    lo = mid + 1;
  } catch (e) {
    hi = mid;
  }
}
console.log('Problematic around line ' + lo);
console.log(lines[lo - 1]);
