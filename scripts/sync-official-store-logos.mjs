/**
 * Download latest official brand logos (Wikimedia Commons / known official SVGs)
 * and write normalized local assets under public/stores/.
 *
 * Does not invent marks — sources are brand logos hosted on Wikimedia Commons
 * (trademarked logos used under fair-use/PD-textlogo where applicable) or
 * previously captured official brand SVGs in scripts/output/.
 */
import fs from "fs";
import path from "path";
import sharp from "sharp";

const root = process.cwd();
const storesDir = path.join(root, "public", "stores");
const outDir = path.join(root, "scripts", "output", "official-logos");

fs.mkdirSync(outDir, { recursive: true });

/** Wikimedia Special:FilePath titles for current official marks. */
const WIKI_FILES = {
  amazon: "Amazon_2024.svg",
  nike: "Logo_NIKE.svg",
  adidas: "Adidas_Logo.svg",
  walmart: "Walmart_logo_(2025).svg",
  ebay: "EBay_logo.svg",
  apple: "Apple_logo_black.svg",
  samsung: "Samsung_Logo.svg",
  "best-buy": "Best_Buy_Logo.svg",
  "foot-locker": "Foot_Locker_wordmark.svg",
  temu: "Temu_logo.svg",
  shein: "SHEIN_logo.svg",
  noon: "Noon.com_logo.svg",
  // AliExpress / CJ often lack clean wiki SVGs — use local official captures
};

const LOCAL_OFFICIAL = {
  aliexpress: "aliexpress-official-2024.svg",
  cjdropshipping: "wiki-search-cj.json", // placeholder key; resolved below
};

async function fetchWikiSvg(fileTitle) {
  const url = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileTitle)}`;
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent": "ZorinoLogoSync/1.0 (local asset rebuild; contact: zorino)",
      Accept: "image/svg+xml,text/plain,*/*",
    },
  });
  if (!res.ok) throw new Error(`Wiki fetch failed ${fileTitle}: ${res.status}`);
  const text = await res.text();
  if (!text.includes("<svg") && !text.includes("<SVG")) {
    throw new Error(`Not SVG for ${fileTitle} (${text.slice(0, 80)})`);
  }
  return text;
}

async function fetchWikiCandidates(titles) {
  let lastErr;
  for (const title of titles) {
    try {
      const svg = await fetchWikiSvg(title);
      return { title, svg };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

function extractInnerSvg(svg) {
  const cleaned = svg
    .replace(/<\?xml[\s\S]*?\?>/i, "")
    .replace(/<!DOCTYPE[\s\S]*?>/i, "")
    .replace(/<!--[\s\S]*?-->/g, "");
  const m = cleaned.match(/<svg\b[^>]*>([\s\S]*)<\/svg>/i);
  if (!m) return { vb: [0, 0, 128, 128], inner: cleaned };
  const open = cleaned.match(/<svg\b([^>]*)>/i)?.[1] ?? "";
  const vbMatch = open.match(/viewBox\s*=\s*"([^"]+)"/i);
  let vb = [0, 0, 128, 128];
  if (vbMatch) {
    vb = vbMatch[1].split(/[\s,]+/).map(Number);
  } else {
    const w = Number(open.match(/\bwidth\s*=\s*"([\d.]+)"/i)?.[1] || 128);
    const h = Number(open.match(/\bheight\s*=\s*"([\d.]+)"/i)?.[1] || 128);
    vb = [0, 0, w, h];
  }
  return { vb, inner: m[1].trim() };
}

/** Square plate with consistent optical padding — logo colors preserved. */
function normalizePlate(aria, sourceSvg, { pad = 18, plate = "#ffffff" } = {}) {
  const { vb, inner } = extractInnerSvg(sourceSvg);
  const [vx, vy, vw, vh] = vb;
  const avail = 128 - pad * 2;
  const scale = Math.min(avail / Math.max(vw, 1), avail / Math.max(vh, 1));
  const tw = vw * scale;
  const th = vh * scale;
  const x = (128 - tw) / 2;
  const y = (128 - th) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" role="img" aria-label="${aria}">
  <rect width="128" height="128" rx="24" fill="${plate}"/>
  <svg x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${tw.toFixed(2)}" height="${th.toFixed(2)}" viewBox="${vx} ${vy} ${vw} ${vh}" preserveAspectRatio="xMidYMid meet">
${inner}
  </svg>
</svg>
`;
}

function writeBrand(slug, svg) {
  const targets = [
    path.join(storesDir, `${slug}.svg`),
    path.join(storesDir, "featured-brands", `${slug}.svg`),
    path.join(storesDir, "top-coupons", `${slug}.svg`),
  ];
  for (const t of targets) {
    fs.mkdirSync(path.dirname(t), { recursive: true });
    fs.writeFileSync(t, svg, "utf8");
  }
  return targets;
}

async function rasterizePng(slug, svg) {
  const buf = await sharp(Buffer.from(svg))
    .resize(512, 512, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png()
    .toBuffer();
  const pngPath = path.join(storesDir, `${slug}.png`);
  fs.writeFileSync(pngPath, buf);
  return pngPath;
}

const FALLBACK_TITLES = {
  amazon: ["Amazon_2024.svg", "Amazon_logo.svg", "Amazon.com_logo.svg"],
  nike: ["Logo_NIKE.svg", "Nike_logo.svg", "Nike_Swoosh.svg"],
  adidas: ["Adidas_Logo.svg", "Adidas_logo.svg", "Adidas_wordmark.svg"],
  walmart: ["Walmart_logo_(2025).svg", "Walmart_logo.svg", "Walmart_2025.svg"],
  ebay: ["EBay_logo.svg", "Ebay_logo.svg", "EBay.svg"],
  apple: ["Apple_logo_black.svg", "Apple_Computer_Logo_black.svg", "Apple_logo_grey.svg"],
  samsung: ["Samsung_Logo.svg", "Samsung_logo_(blue).svg", "Samsung_wordmark.svg"],
  "best-buy": ["Best_Buy_Logo.svg", "Best_Buy_logo.svg", "Best_Buy_logo_2018.svg"],
  "foot-locker": ["Foot_Locker_wordmark.svg", "Foot_Locker_logo.svg", "Foot_Locker.svg"],
  temu: ["Temu_logo.svg", "Temu_Logo.svg", "Temu.svg"],
  shein: ["SHEIN_logo.svg", "Shein_logo.svg", "SHEIN.svg"],
  noon: ["Noon.com_logo.svg", "Noon_logo.svg", "Noon_(company)_logo.svg"],
};

async function main() {
  const report = [];

  for (const [slug, titles] of Object.entries(FALLBACK_TITLES)) {
    try {
      const { title, svg } = await fetchWikiCandidates(titles);
      fs.writeFileSync(path.join(outDir, `${slug}.source.svg`), svg, "utf8");
      const plate = normalizePlate(slug, svg, {
        pad: slug === "nike" || slug === "apple" ? 28 : 16,
      });
      writeBrand(slug, plate);
      await rasterizePng(slug, plate);
      report.push({ slug, ok: true, source: title });
      console.log(`OK ${slug} ← ${title}`);
    } catch (e) {
      report.push({ slug, ok: false, error: String(e.message || e) });
      console.error(`FAIL ${slug}:`, e.message || e);
    }
  }

  // AliExpress — use local official capture if present
  const aeLocal = path.join(root, "scripts", "output", "aliexpress-official-2024.svg");
  if (fs.existsSync(aeLocal)) {
    const svg = fs.readFileSync(aeLocal, "utf8");
    const plate = normalizePlate("AliExpress", svg, { pad: 14 });
    writeBrand("aliexpress", plate);
    await rasterizePng("aliexpress", plate);
    report.push({ slug: "aliexpress", ok: true, source: "aliexpress-official-2024.svg" });
    console.log("OK aliexpress ← local official");
  } else {
    try {
      const { title, svg } = await fetchWikiCandidates([
        "AliExpress_logo.svg",
        "Aliexpress_logo.svg",
        "AliExpress.svg",
      ]);
      const plate = normalizePlate("AliExpress", svg, { pad: 14 });
      writeBrand("aliexpress", plate);
      await rasterizePng("aliexpress", plate);
      report.push({ slug: "aliexpress", ok: true, source: title });
      console.log(`OK aliexpress ← ${title}`);
    } catch (e) {
      report.push({ slug: "aliexpress", ok: false, error: String(e.message || e) });
      console.error("FAIL aliexpress:", e.message || e);
    }
  }

  // CJ Dropshipping — try wiki then keep existing if fail
  try {
    const { title, svg } = await fetchWikiCandidates([
      "CJ_Dropshipping_logo.svg",
      "CJdropshipping_logo.svg",
    ]);
    const plate = normalizePlate("CJ Dropshipping", svg, { pad: 16 });
    writeBrand("cjdropshipping", plate);
    await rasterizePng("cjdropshipping", plate);
    report.push({ slug: "cjdropshipping", ok: true, source: title });
    console.log(`OK cjdropshipping ← ${title}`);
  } catch (e) {
    // Prefer existing wiki-derived file if present in scripts/output
    const wikiCj = path.join(root, "scripts", "output", "si-cjdropshipping.svg");
    if (fs.existsSync(wikiCj) && fs.statSync(wikiCj).size > 100) {
      const svg = fs.readFileSync(wikiCj, "utf8");
      const plate = normalizePlate("CJ Dropshipping", svg, { pad: 16 });
      writeBrand("cjdropshipping", plate);
      await rasterizePng("cjdropshipping", plate);
      report.push({ slug: "cjdropshipping", ok: true, source: "si-cjdropshipping.svg" });
      console.log("OK cjdropshipping ← local si");
    } else {
      report.push({ slug: "cjdropshipping", ok: false, error: String(e.message || e) });
      console.error("FAIL cjdropshipping:", e.message || e);
    }
  }

  fs.writeFileSync(
    path.join(outDir, "sync-report.json"),
    JSON.stringify(report, null, 2),
    "utf8",
  );
  console.log("\nDone. Report:", path.join(outDir, "sync-report.json"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
