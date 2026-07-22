import fs from "fs";
import path from "path";
import sharp from "sharp";

const root = process.cwd();
const storesDir = path.join(root, "public", "stores");

function sanitize(svg) {
  return svg
    .replace(/<\?xml[\s\S]*?\?>/gi, "")
    .replace(/<!DOCTYPE[\s\S]*?>/gi, "")
    .replace(/<metadata[\s\S]*?<\/metadata>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\sxmlns:(sodipodi|inkscape|rdf|cc|dc)="[^"]*"/gi, "")
    .replace(/\s(sodipodi|inkscape):[a-zA-Z0-9:_-]+="[^"]*"/gi, "")
    .replace(/<(sodipodi|inkscape):[^>]*\/>/gi, "")
    .replace(/<(sodipodi|inkscape):[^>]*>[\s\S]*?<\/\1:[^>]*>/gi, "");
}

function extract(svg) {
  const cleaned = sanitize(svg);
  const m = cleaned.match(/<svg\b[^>]*>([\s\S]*)<\/svg>/i);
  const open = cleaned.match(/<svg\b([^>]*)>/i)?.[1] ?? "";
  const vbMatch = open.match(/viewBox\s*=\s*"([^"]+)"/i);
  let vb = [0, 0, 128, 128];
  if (vbMatch) vb = vbMatch[1].split(/[\s,]+/).map(Number);
  return { vb, inner: m ? m[1].trim() : cleaned };
}

function plate(aria, svg, pad = 16) {
  const { vb, inner } = extract(svg);
  const [vx, vy, vw, vh] = vb;
  const avail = 128 - pad * 2;
  const scale = Math.min(avail / Math.max(vw, 1), avail / Math.max(vh, 1));
  const tw = vw * scale;
  const th = vh * scale;
  const x = (128 - tw) / 2;
  const y = (128 - th) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" role="img" aria-label="${aria}">
  <rect width="128" height="128" rx="24" fill="#ffffff"/>
  <svg x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${tw.toFixed(2)}" height="${th.toFixed(2)}" viewBox="${vx} ${vy} ${vw} ${vh}" preserveAspectRatio="xMidYMid meet">
${inner}
  </svg>
</svg>
`;
}

async function write(slug, sourcePath, pad) {
  const svg = fs.readFileSync(sourcePath, "utf8");
  const clean = sanitize(plate(slug, svg, pad));
  for (const sub of ["", "featured-brands", "top-coupons"]) {
    const dir = sub ? path.join(storesDir, sub) : storesDir;
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${slug}.svg`), clean);
  }
  const buf = await sharp(Buffer.from(clean))
    .resize(512, 512, {
      fit: "contain",
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(storesDir, `${slug}.png`), buf);
  console.log("OK", slug, buf.length);
}

async function fetchWiki(title, dest) {
  const res = await fetch(
    `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(title)}`,
    { headers: { "User-Agent": "ZorinoLogoSync/1.0" }, redirect: "follow" },
  );
  if (!res.ok) throw new Error(`${title} ${res.status}`);
  const text = await res.text();
  if (!/<svg/i.test(text)) throw new Error(`${title} not svg`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, text);
  return dest;
}

async function main() {
  const flDest = path.join(root, "scripts/output/official-logos/foot-locker.source.svg");
  try {
    await fetchWiki("Foot_Locker_2020_Wordmark_Logo.svg", flDest);
    await write("foot-locker", flDest, 14);
  } catch (e) {
    console.error("FL wiki:", e.message);
    await write("foot-locker", path.join(root, "scripts/output/wiki-footlocker.svg"), 14);
  }

  const sDest = path.join(root, "scripts/output/official-logos/samsung.source.svg");
  if (!fs.existsSync(sDest)) {
    await fetchWiki("Samsung_Logo.svg", sDest);
  }
  await write("samsung", sDest, 18);

  // CJ: reuse existing store SVG if valid
  const cj = path.join(storesDir, "cjdropshipping.svg");
  if (fs.existsSync(cj) && fs.statSync(cj).size > 200) {
    const raw = fs.readFileSync(cj, "utf8");
    if (/<svg/i.test(raw) && !/404/.test(raw)) {
      await write("cjdropshipping", cj, 16);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
