// matte.js — convert white-background illustrations into true alpha PNGs.
// Un-composites "artwork photographed on white": assumes the pixel is
// original-color composited over white, recovers alpha from luminance
// and un-premultiplies the channels back. JPEG noise floor is clamped.
// Pass --trim as the last arg to crop transparent margins (2% padding).
//
// Usage: node matte.js <in> <out> [strength=1] [maxAlpha=1] [--trim]
const fs = require('fs');
const { PNG } = require('pngjs');
const jpeg = require('jpeg-js');

const args = process.argv.slice(2);
const trim = args.includes('--trim');
const [inPath, outPath, strengthArg, maxAlphaArg] = args.filter((a) => a !== '--trim');
if (!inPath || !outPath) {
  console.error('usage: node matte.js <in> <out> [strength] [maxAlpha] [--trim]');
  process.exit(1);
}
const strength = parseFloat(strengthArg ?? '1');
const maxAlpha = parseFloat(maxAlphaArg ?? '1');

const raw = fs.readFileSync(inPath);
let img;
if (raw[0] === 0x89 && raw[1] === 0x50) {
  img = PNG.sync.read(raw);
} else {
  img = jpeg.decode(raw, { useTArray: true, maxMemoryUsageInMB: 1024 });
}

const { width, height, data } = img;
const out = new PNG({ width, height });
const NOISE = 0.04;

for (let i = 0; i < width * height; i++) {
  const r = data[i * 4] / 255;
  const g = data[i * 4 + 1] / 255;
  const b = data[i * 4 + 2] / 255;
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;

  let a = (1 - lum) * strength;
  a = Math.min(a, maxAlpha);
  if (a < NOISE) a = 0;
  else if (a > 0.96) a = 1;

  if (a <= 0) {
    out.data[i * 4] = 0;
    out.data[i * 4 + 1] = 0;
    out.data[i * 4 + 2] = 0;
  } else {
    // un-premultiply against white: cOrig = (cWhite - (1 - a)) / a
    out.data[i * 4] = Math.round(Math.min(255, Math.max(0, ((r - (1 - a)) / a) * 255)));
    out.data[i * 4 + 1] = Math.round(Math.min(255, Math.max(0, ((g - (1 - a)) / a) * 255)));
    out.data[i * 4 + 2] = Math.round(Math.min(255, Math.max(0, ((b - (1 - a)) / a) * 255)));
  }
  out.data[i * 4 + 3] = Math.round(a * 255);
}

let final = out;
if (trim) {
  // crop to the alpha bounding box with 2% padding
  let minX = width, minY = height, maxX = 0, maxY = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (out.data[(y * width + x) * 4 + 3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX > minX && maxY > minY) {
    const pad = Math.round(Math.max(maxX - minX, maxY - minY) * 0.02);
    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(width - 1, maxX + pad);
    maxY = Math.min(height - 1, maxY + pad);
    const w = maxX - minX + 1;
    const h = maxY - minY + 1;
    final = new PNG({ width: w, height: h });
    for (let y = 0; y < h; y++) {
      const srcStart = ((y + minY) * width + minX) * 4;
      final.data.set(out.data.subarray(srcStart, srcStart + w * 4), y * w * 4);
    }
  }
}

fs.writeFileSync(outPath, PNG.sync.write(final));
console.log(`matted ${inPath} -> ${outPath} (${final.width}x${final.height}${trim ? ', trimmed' : ''})`);
