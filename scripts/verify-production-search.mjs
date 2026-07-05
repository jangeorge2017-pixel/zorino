const queries = ["iPhone", "iPhone 15", "Samsung S24", "Galaxy A55", "MacBook Air", "PS5"];
const base = "https://www.zorino.org/en/search?q=";

function parseTitles(html) {
  return [...html.matchAll(/class="deal-name">([^<]+)/g)].map((m) =>
    m[1].replace(/&amp;/g, "&").replace(/&quot;/g, '"').trim()
  );
}

function looksLikeDeviceTitle(title) {
  const hay = title.toLowerCase();
  if (/\b(case|cover|protector|charger|cable|skin|holder|mount)\b/.test(hay)) return false;
  if (/\b\d+\s*(gb|tb)\b/.test(hay) && /\b(iphone|galaxy|samsung|macbook|ps5|playstation)\b/.test(hay)) {
    return true;
  }
  if (/\b(unlocked|smartphone|console|5g)\b/.test(hay)) return true;
  return false;
}

console.log("=== Production Search Quality Report ===\n");
console.log("Commit: 34e833a | Engine: global provider-independent\n");

let pass = 0;
for (const q of queries) {
  const res = await fetch(base + encodeURIComponent(q), {
    headers: { "Accept-Language": "en", Cookie: "NEXT_LOCALE=en" },
  });
  const html = await res.text();
  const titles = parseTitles(html);
  const devices = titles.filter(looksLikeDeviceTitle);
  const accessories = titles.filter((t) => !looksLikeDeviceTitle(t));

  const devicesFirst =
    accessories.length === 0 ||
    devices.length === 0 ||
    titles.findIndex((t) => !looksLikeDeviceTitle(t)) >= devices.length;

  const ok = titles.length > 0 && devicesFirst;
  if (ok) pass++;

  console.log(`${ok ? "PASS" : "FAIL"} — ${q}: ${titles.length} results (${devices.length} devices, ${accessories.length} accessories)`);
  console.log(`  #1: ${titles[0]?.slice(0, 85) ?? "(none)"}`);
  if (devices[0] && titles[0] !== devices[0]) {
    console.log(`  first device: ${devices[0].slice(0, 85)}`);
  }
  console.log();
}

console.log(`Summary: ${pass}/${queries.length} queries passed device-first ordering`);
