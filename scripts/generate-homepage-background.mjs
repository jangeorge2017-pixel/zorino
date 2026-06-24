import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const REFERENCE = "public/reference/zorino-final-design.png";
const OUT_DIR = "public/backgrounds";

/** Hero Z silhouette region in reference (1536×1024) — exclude from sharp detail retention */
const HERO_Z_REGION = { x: 720, y: 60, w: 760, h: 520 };

function inHeroZRegion(x, y) {
  const r = HERO_Z_REGION;
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

function isStarSpeck(r, g, b, data, width, height, channels, x, y) {
  if (inHeroZRegion(x, y)) return false;
  const bright = Math.max(r, g, b);
  if (bright < 90 || bright > 245) return false;

  let darkCount = 0;
  let samples = 0;
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const ni = (ny * width + nx) * channels;
      if (Math.max(data[ni], data[ni + 1], data[ni + 2]) < 55) darkCount++;
      samples++;
    }
  }
  return samples > 0 && darkCount / samples > 0.55;
}

async function sampleEdgeColors(input) {
  const { data, info } = await sharp(input).raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const points = [
    [0, height - 1],
    [width - 1, height - 1],
    [Math.floor(width / 2), height - 1],
    [0, 0],
    [width - 1, 0],
  ];
  let r = 0;
  let g = 0;
  let b = 0;
  for (const [x, y] of points) {
    const i = (y * width + x) * channels;
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
  }
  return {
    r: Math.round(r / points.length),
    g: Math.round(g / points.length),
    b: Math.round(b / points.length),
  };
}

async function extractAtmosphereOnly(input, width, height) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({
    resolveWithObject: true,
  });
  const channels = info.channels;

  const blurred = await sharp(input).blur(92).ensureAlpha().raw().toBuffer();
  const output = Buffer.from(blurred);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const pi = idx * channels;
      const r = data[pi];
      const g = data[pi + 1];
      const b = data[pi + 2];

      if (isStarSpeck(r, g, b, data, width, height, channels, x, y)) {
        const blend = 0.85;
        output[pi] = Math.round(blurred[pi] * (1 - blend) + r * blend);
        output[pi + 1] = Math.round(blurred[pi + 1] * (1 - blend) + g * blend);
        output[pi + 2] = Math.round(blurred[pi + 2] * (1 - blend) + b * blend);
      }
    }
  }

  return output;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const meta = await sharp(REFERENCE).metadata();
  const width = meta.width ?? 1536;
  const height = meta.height ?? 1024;
  const corner = await sampleEdgeColors(REFERENCE);

  const basePath = path.join(OUT_DIR, "zorino-homepage-bg.png");
  const retinaPath = path.join(OUT_DIR, "zorino-homepage-bg@2x.png");

  const atmosphere = await extractAtmosphereOnly(REFERENCE, width, height);

  await sharp(atmosphere, { raw: { width, height, channels: 4 } })
    .png({ compressionLevel: 6, quality: 100, effort: 10 })
    .toFile(basePath);

  await sharp(basePath)
    .resize(width * 2, height * 2, { kernel: sharp.kernel.lanczos3 })
    .png({ compressionLevel: 6, quality: 100, effort: 10 })
    .toFile(retinaPath);

  const manifest = {
    source: "/reference/zorino-final-design.png",
    background: "/backgrounds/zorino-homepage-bg.png",
    background2x: "/backgrounds/zorino-homepage-bg@2x.png",
    intrinsic: { width, height },
    cornerColor: corner,
    generatedAt: new Date().toISOString(),
    note: "Atmosphere only — no Z, no UI. Blurred reference + particles; hero Z region uses blur only.",
  };

  fs.writeFileSync(path.join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify(manifest, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
