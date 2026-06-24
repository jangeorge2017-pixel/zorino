import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const FILES = [
  "public/hero-z-logo.png",
  "public/logo/hero-z-logo@2x.png",
  "public/logo/hero-z-logo@3x.png",
  "public/logo/hero-z-logo@4x.png",
];

function isDarkBackdrop(r, g, b) {
  const bright = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const sat = bright - min;
  return bright <= 48 && sat <= 22;
}

async function processLogo(input) {
  if (!fs.existsSync(input)) {
    console.warn(`Skip missing ${input}`);
    return;
  }

  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({
    resolveWithObject: true,
  });
  const { width, height, channels } = info;
  const total = width * height;
  const remove = new Uint8Array(total);

  const queue = [];
  for (let x = 0; x < width; x++) {
    queue.push([x, 0], [x, height - 1]);
  }
  for (let y = 0; y < height; y++) {
    queue.push([0, y], [width - 1, y]);
  }

  const visited = new Uint8Array(total);
  while (queue.length) {
    const [x, y] = queue.pop();
    const idx = y * width + x;
    if (visited[idx]) continue;
    visited[idx] = 1;

    const pi = idx * channels;
    const r = data[pi];
    const g = data[pi + 1];
    const b = data[pi + 2];

    if (!isDarkBackdrop(r, g, b)) continue;
    remove[idx] = 1;

    if (x > 0) queue.push([x - 1, y]);
    if (x < width - 1) queue.push([x + 1, y]);
    if (y > 0) queue.push([x, y - 1]);
    if (y < height - 1) queue.push([x, y + 1]);
  }

  const outputBuf = Buffer.from(data);
  let cleared = 0;
  for (let i = 0; i < total; i++) {
    if (remove[i]) {
      outputBuf[i * channels + 3] = 0;
      cleared++;
    }
  }

  await sharp(outputBuf, { raw: { width, height, channels } })
    .png({ compressionLevel: 6, quality: 100 })
    .toFile(input);

  console.log(`${input}: cleared ${cleared} backdrop pixels (${((cleared / total) * 100).toFixed(1)}%)`);
}

for (const file of FILES) {
  await processLogo(file);
}
