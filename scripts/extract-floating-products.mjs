import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

/**
 * Product-only crops from public/reference/zorino-final-design.png.
 * Hero visual region: left 620, top 70, size 880×480 (see scripts/crop-hero-debug.mjs).
 */
const REFERENCE = "public/reference/zorino-final-design.png";
const OUT_DIR = "public/icons";
const HERO = { left: 620, top: 70 };

/** Card rectangles in hero-local coordinates, then inner product rects. */
const PRODUCTS = [
  {
    id: "floating-headphones",
    card: { x: 68, y: 37, w: 175, h: 98 },
    product: { x: 35, y: 14, w: 135, h: 65 },
  },
  {
    id: "floating-phone",
    card: { x: 638, y: 37, w: 145, h: 95 },
    product: { x: 6, y: 6, w: 56, h: 80 },
  },
  {
    id: "floating-laptop",
    card: { x: 58, y: 172, w: 148, h: 95 },
    product: { x: 0, y: 12, w: 130, h: 68 },
  },
  {
    id: "floating-controller",
    card: { x: 638, y: 172, w: 132, h: 95 },
    product: { x: 2, y: 6, w: 72, h: 72 },
  },
];

async function extractProduct({ id, card, product }) {
  const cardBuf = await sharp(REFERENCE)
    .extract({
      left: HERO.left + card.x,
      top: HERO.top + card.y,
      width: card.w,
      height: card.h,
    })
    .png()
    .toBuffer();

  const scale = 2.5;
  await sharp(cardBuf)
    .extract({
      left: product.x,
      top: product.y,
      width: product.w,
      height: product.h,
    })
    .resize(
      Math.round(product.w * scale),
      Math.round(product.h * scale),
      { fit: "inside", kernel: "lanczos3" },
    )
    .png({ compressionLevel: 6 })
    .toFile(path.join(OUT_DIR, `${id}.png`));

  const meta = await sharp(path.join(OUT_DIR, `${id}.png`)).metadata();
  console.log(`Extracted ${id}.png → ${meta.width}×${meta.height}`);
}

async function writeManifest() {
  const manifest = {
    source: REFERENCE,
    heroRegion: { ...HERO, width: 880, height: 480 },
    note: "Product-only crops for glass floating cards (object-fit: contain at ~70%)",
    products: PRODUCTS.map(({ id, card, product }) => ({
      file: `/icons/${id}.png`,
      cardRect: card,
      productRect: product,
    })),
    generatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const product of PRODUCTS) {
    await extractProduct(product);
  }
  await writeManifest();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
