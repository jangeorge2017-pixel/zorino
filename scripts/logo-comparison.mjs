import sharp from "sharp";
import fs from "node:fs";

const outDir = "public/comparison";
fs.mkdirSync(outDir, { recursive: true });

const source = "public/hero-z.png";
const beforeSvg = "public/comparison/logo-before-flat.svg";

// Source logo at navbar display size (38px) and hero preview size (200px)
const navbarSize = 38;
const previewSize = 200;

await sharp(source).resize(navbarSize, navbarSize, { fit: "contain" }).png().toFile(`${outDir}/logo-after-navbar-38.png`);
await sharp(source).resize(previewSize, previewSize, { fit: "contain" }).png().toFile(`${outDir}/logo-after-preview-200.png`);
await sharp(source).resize(552, 552, { fit: "contain" }).png().toFile(`${outDir}/logo-source-hero-scale.png`);

// Old flat SVG rendered for before comparison
await sharp(beforeSvg).resize(navbarSize, navbarSize, { fit: "contain" }).png().toFile(`${outDir}/logo-before-navbar-38.png`);
await sharp(beforeSvg).resize(previewSize, previewSize, { fit: "contain" }).png().toFile(`${outDir}/logo-before-preview-200.png`);

// Side-by-side comparison at 200px
const beforeBuf = await sharp(`${outDir}/logo-before-preview-200.png`).extend({ top: 40, bottom: 10, left: 10, right: 10, background: { r: 4, g: 6, b: 21, alpha: 1 } }).toBuffer();
const afterBuf = await sharp(`${outDir}/logo-after-preview-200.png`).extend({ top: 40, bottom: 10, left: 10, right: 10, background: { r: 4, g: 6, b: 21, alpha: 1 } }).toBuffer();

await sharp({
  create: {
    width: 460,
    height: 280,
    channels: 4,
    background: { r: 4, g: 6, b: 21, alpha: 1 },
  },
})
  .composite([
    { input: beforeBuf, left: 10, top: 10 },
    { input: afterBuf, left: 240, top: 10 },
  ])
  .png()
  .toFile(`${outDir}/logo-before-after-comparison.png`);

console.log("Generated logo comparison images in public/comparison/");
