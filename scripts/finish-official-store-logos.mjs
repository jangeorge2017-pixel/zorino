/**
 * Finish remaining official logos + sanitize SVGs for sharp PNG export.
 */
import fs from "fs";
import path from "path";
import sharp from "sharp";

const root = process.cwd();
const storesDir = path.join(root, "public", "stores");
const outDir = path.join(root, "scripts", "output", "official-logos");
fs.mkdirSync(outDir, { recursive: true });

function sanitizeSvg(svg) {
  return svg
    .replace(/<\?xml[\s\S]*?\?>/gi, "")
    .replace(/<!DOCTYPE[\s\S]*?>/gi, "")
    .replace(/\sxmlns:(sodipodi|inkscape|rdf|cc|dc)="[^"]*"/gi, "")
    .replace(/<(sodipodi|inkscape):[^>]*>/gi, "")
    .replace(/<\/(sodipodi|inkscape):[^>]*>/gi, "")
    .replace(/\s(sodipodi|inkscape):[a-zA-Z0-9:-]+="[^"]*"/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");
}

function extractInnerSvg(svg) {
  const cleaned = sanitizeSvg(svg);
  const m = cleaned.match(/<svg\b[^>]*>([\s\S]*)<\/svg>/i);
  if (!m) return { vb: [0, 0, 128, 128], inner: cleaned };
  const open = cleaned.match(/<svg\b([^>]*)>/i)?.[1] ?? "";
  const vbMatch = open.match(/viewBox\s*=\s*"([^"]+)"/i);
  let vb = [0, 0, 128, 128];
  if (vbMatch) vb = vbMatch[1].split(/[\s,]+/).map(Number);
  else {
    const w = Number(open.match(/\bwidth\s*=\s*"([\d.]+)"/i)?.[1] || 128);
    const h = Number(open.match(/\bheight\s*=\s*"([\d.]+)"/i)?.[1] || 128);
    vb = [0, 0, w, h];
  }
  return { vb, inner: m[1].trim() };
}

function normalizePlate(aria, sourceSvg, { pad = 16 } = {}) {
  const { vb, inner } = extractInnerSvg(sourceSvg);
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

function writeBrand(slug, svg) {
  for (const sub of ["", "featured-brands", "top-coupons"]) {
    const dir = sub ? path.join(storesDir, sub) : storesDir;
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${slug}.svg`), svg, "utf8");
  }
}

async function rasterizePng(slug, svg) {
  const clean = sanitizeSvg(svg);
  const buf = await sharp(Buffer.from(clean))
    .resize(512, 512, {
      fit: "contain",
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(storesDir, `${slug}.png`), buf);
}

async function fetchWiki(titles) {
  let last;
  for (const title of titles) {
    try {
      const url = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(title)}`;
      const res = await fetch(url, {
        redirect: "follow",
        headers: {
          "User-Agent": "ZorinoLogoSync/1.0 (asset rebuild)",
          Accept: "image/svg+xml,*/*",
        },
      });
      if (!res.ok) {
        last = new Error(`${title} ${res.status}`);
        await new Promise((r) => setTimeout(r, 800));
        continue;
      }
      const text = await res.text();
      if (!/<svg/i.test(text)) {
        last = new Error(`${title} not svg`);
        continue;
      }
      return { title, svg: text };
    } catch (e) {
      last = e;
    }
  }
  throw last;
}

function readLocal(rel) {
  const p = path.join(root, "scripts", "output", rel);
  if (!fs.existsSync(p) || fs.statSync(p).size < 80) return null;
  return fs.readFileSync(p, "utf8");
}

const JOBS = [
  {
    slug: "walmart",
    wiki: ["Walmart_logo_(2025).svg", "Walmart_logo.svg"],
    pad: 14,
  },
  {
    slug: "ebay",
    wiki: ["EBay_logo.svg", "Ebay_logo.svg"],
    pad: 16,
  },
  {
    slug: "shein",
    wiki: ["Shein_Logo_2017.svg", "SHEIN_logo.svg"],
    local: ["wiki-shein.svg"],
    pad: 16,
  },
  {
    slug: "noon",
    wiki: ["Noon.com_logo.svg", "Noon_logo.svg"],
    local: ["wiki-noon.svg"],
    pad: 16,
  },
  {
    slug: "foot-locker",
    wiki: ["Foot_Locker_2020_Wordmark_Logo.svg", "Foot_Locker_wordmark.svg"],
    local: ["wiki-footlocker.svg"],
    pad: 14,
  },
  {
    slug: "samsung",
    wiki: ["Samsung_Logo.svg", "Samsung_logo_(blue).svg"],
    pad: 18,
  },
  {
    slug: "cjdropshipping",
    wiki: ["CJ_Dropshipping_logo.svg"],
    local: ["si-cjdropshipping.svg", "si-gh-cjdropshipping.svg"],
    pad: 16,
  },
];

async function main() {
  // Also re-rasterize already-written SVGs that may lack PNG
  const existing = [
    "amazon",
    "nike",
    "adidas",
    "apple",
    "best-buy",
    "temu",
    "aliexpress",
  ];
  for (const slug of existing) {
    const svgPath = path.join(storesDir, `${slug}.svg`);
    if (!fs.existsSync(svgPath)) continue;
    const svg = fs.readFileSync(svgPath, "utf8");
    try {
      await rasterizePng(slug, svg);
      console.log(`PNG ok ${slug}`);
    } catch (e) {
      console.error(`PNG fail ${slug}:`, e.message);
    }
  }

  for (const job of JOBS) {
    let svg = null;
    let source = null;
    if (job.local) {
      for (const rel of job.local) {
        const t = readLocal(rel);
        if (t && /<svg/i.test(t)) {
          svg = t;
          source = rel;
          break;
        }
      }
    }
    if (!svg && job.wiki) {
      try {
        await new Promise((r) => setTimeout(r, 1200));
        const got = await fetchWiki(job.wiki);
        svg = got.svg;
        source = got.title;
        fs.writeFileSync(path.join(outDir, `${job.slug}.source.svg`), svg, "utf8");
      } catch (e) {
        console.error(`Wiki fail ${job.slug}:`, e.message || e);
      }
    }
    if (!svg) {
      console.error(`SKIP ${job.slug}: no source`);
      continue;
    }
    const plate = normalizePlate(job.slug, svg, { pad: job.pad ?? 16 });
    writeBrand(job.slug, plate);
    try {
      await rasterizePng(job.slug, plate);
      console.log(`OK ${job.slug} ← ${source}`);
    } catch (e) {
      console.error(`Raster fail ${job.slug}:`, e.message);
      // still keep SVG
      console.log(`SVG-only ${job.slug} ← ${source}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
