import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const SOURCE = "public/hero-z-logo.png";
const SVG_OUT = "public/hero-z-logo.svg";
const VARIANT_DIR = "public/logo";

const RETINA_SCALES = {
  "@1x": 1,
  "@2x": 2,
  "@3x": 3,
  "@4x": 4,
};

async function main() {
  const meta = await sharp(SOURCE).metadata();
  const width = meta.width ?? 235;
  const height = meta.height ?? 82;

  fs.mkdirSync(VARIANT_DIR, { recursive: true });

  for (const [suffix, scale] of Object.entries(RETINA_SCALES)) {
    const targetW = width * scale;
    const targetH = height * scale;
    const outPath =
      suffix === "@1x"
        ? SOURCE
        : path.join(VARIANT_DIR, `hero-z-logo${suffix}.png`);

    if (suffix === "@1x") continue;

    await sharp(SOURCE)
      .resize(targetW, targetH, {
        kernel: sharp.kernel.lanczos3,
        fit: "fill",
      })
      .png({ compressionLevel: 6, quality: 100, effort: 10 })
      .toFile(outPath);
  }

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="Zorino logo">
  <title>Zorino logo</title>
  <image href="/hero-z-logo.png" xlink:href="/hero-z-logo.png" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet"/>
</svg>
`;

  fs.writeFileSync(SVG_OUT, svg);

  const manifest = {
    source: "/hero-z-logo.png",
    svg: "/hero-z-logo.svg",
    intrinsic: { width, height },
    generatedAt: new Date().toISOString(),
    variants: Object.fromEntries(
      Object.entries(RETINA_SCALES).map(([suffix, scale]) => [
        suffix,
        suffix === "@1x"
          ? "/hero-z-logo.png"
          : `/logo/hero-z-logo${suffix}.png`,
      ]),
    ),
    note: "SVG is a 1:1 wrapper over hero-z-logo.png — no paths redrawn, no effects replaced.",
  };

  fs.writeFileSync(path.join(VARIANT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));

  console.log(JSON.stringify(manifest, null, 2));
  console.log(`Wrote ${SVG_OUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
