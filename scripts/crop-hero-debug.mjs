import sharp from "sharp";
import fs from "node:fs";

const REF = "public/reference/zorino-final-design.png";

async function main() {
  fs.mkdirSync("public/comparison", { recursive: true });
  // Hero visual region (right side of hero)
  await sharp(REF)
    .extract({ left: 620, top: 70, width: 880, height: 480 })
    .png()
    .toFile("public/comparison/reference-hero-visual-crop.png");
  console.log("Saved hero visual crop 880x480 at (620,70)");
}

main();
