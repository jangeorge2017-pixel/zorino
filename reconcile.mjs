const BASE = "https://www.zorino.org";
const CAT_PATH = (p) => "/en" + (p.startsWith("/") ? p : "/" + pplace(p));
const FAMILIES = [
  { name: "iPhone 15 Pro Max", cat: "/categories/phones", q: "iphone%2015%20pro%20max" },
  { name: "Samsung Galaxy S24", cat: "/categories/phones", q: "samsung%20galaxy%20s24" },
  { name: "MacBook Air M3", cat: "/categories/laptops", q: "macbook%20air%20m3" },
  { name: "HONOR 10 Lite", cat: "/categories/phones", q: "honor%2010%20lite" },
  { name: "AirPods Pro", cat: "/categories/audio", q: "airpods%20pro" },
];
const pidsFrom = (html) => {
  const s = new Set();
  for (const m of html.matchAll(/[?&]productId=([^"& <]+)/g)) {
    let v = ""; try { v = decodeURIComponent(m[1]); } catch { v = m[1]; }
    if (v) s.add(v);
  }
  return s;
};
const provOf = (s) => {
  const c = {};
  for (const p of s) { const k = p.split(",")[0].split(":")[0].split("-")[0]; c[k] = (c[k] || 0) + 1; }
  return c;
};
(async () => {
  for (const f of FAMILIES) {
    const catPids = pidsFrom(await (await fetch(BASE + "/en" + f.cat)).text());
    const seaPids = pidsFrom(await (await fetch(BASE + "/en/search?q=" + f.q)).text());
    const share = [...seaPids].filter((p) => catPids.has(p));
    console.log("FAMILY " + f.name);
    console.log("  cats " + f.cat + ": n=" + catPids.size + " providers=" + JSON.stringify(provOf(catPids)));
    console.log("  search q=" + f.q + ": n=" + seaPids.size + " providers=" + JSON.stringify(provOf(seaPids)));
    console.log("  exact-pid overlap (same provider+pid on BOTH surfaces): " + share.length);
    share.slice(0, 2).forEach((p) => console.log("     -> " + p));
  }
})().catch((e) => { console.error(e); process.exit(1); });
