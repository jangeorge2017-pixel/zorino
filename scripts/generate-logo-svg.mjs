import sharp from "sharp";
import fs from "node:fs";

const input = "public/hero-z.png";
const meta = await sharp(input).metadata();
const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;

let minX = width;
let minY = height;
let maxX = 0;
let maxY = 0;

for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const i = (y * width + x) * channels;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a > 12 && r + g + b > 20) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
}

const pad = 8;
minX = Math.max(0, minX - pad);
minY = Math.max(0, minY - pad);
maxX = Math.min(width - 1, maxX + pad);
maxY = Math.min(height - 1, maxY + pad);
const vw = maxX - minX + 1;
const vh = maxY - minY + 1;

const svgFull = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="Zorino logo">
  <title>Zorino logo</title>
  <image href="/hero-z.png" xlink:href="/hero-z.png" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet"/>
</svg>
`;

const svgCrop = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${minX} ${minY} ${vw} ${vh}" width="${vw}" height="${vh}" role="img" aria-label="Zorino logo mark">
  <title>Zorino logo mark</title>
  <image href="/hero-z.png" xlink:href="/hero-z.png" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet"/>
</svg>
`;

fs.writeFileSync("public/hero-z-logo.svg", svgFull);

console.log(
  JSON.stringify(
    { width, height, minX, minY, maxX, maxY, vw, vh, format: meta.format },
    null,
    2,
  ),
);
