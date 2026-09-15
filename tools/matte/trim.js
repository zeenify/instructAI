// trim.js — crop transparent margins from an RGBA PNG (2% padding).
// Usage: node trim.js <in-out-path>
const fs = require('fs');
const { PNG } = require('pngjs');

const path = process.argv[2];
if (!path) {
  console.error('usage: node trim.js <file>');
  process.exit(1);
}
const img = PNG.sync.read(fs.readFileSync(path));
const { width, height, data } = img;

let minX = width, minY = height, maxX = 0, maxY = 0;
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    if (data[(y * width + x) * 4 + 3] > 8) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
}
if (maxX <= minX || maxY <= minY) {
  console.log(`${path}: fully transparent, skipped`);
  process.exit(0);
}
const pad = Math.round(Math.max(maxX - minX, maxY - minY) * 0.02);
minX = Math.max(0, minX - pad);
minY = Math.max(0, minY - pad);
maxX = Math.min(width - 1, maxX + pad);
maxY = Math.min(height - 1, maxY + pad);
const w = maxX - minX + 1;
const h = maxY - minY + 1;
const out = new PNG({ width: w, height: h });
for (let y = 0; y < h; y++) {
  const srcStart = ((y + minY) * width + minX) * 4;
  out.data.set(data.subarray(srcStart, srcStart + w * 4), y * w * 4);
}
fs.writeFileSync(path, PNG.sync.write(out));
console.log(`trimmed ${path} -> ${w}x${h}`);
