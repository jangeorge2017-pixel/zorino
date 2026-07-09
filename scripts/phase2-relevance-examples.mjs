/** Local relevance examples (no API). Mirrors lib/integrations/aliexpress/relevance.ts */

const ACCESSORY_TERMS = [
  "case", "cover", "charger", "cable", "protector", "tempered", "screen protector",
  "film", "sticker", "strap", "holder", "adapter", "stand", "mount", "skin", "shell",
  "pouch", "bag", "box only", "replacement", "silicone", "leather case", "soft case",
  "hard case", "magnetic case", "charging dock", "wireless charger",
];

function queryTokens(query) {
  return query.toLowerCase().replace(/[^a-z0-9\s.+-]/g, " ").split(/\s+/).filter((t) => t.length >= 2);
}

function scoreTitleRelevance(title, query) {
  const tokens = queryTokens(query);
  if (tokens.length === 0) return -1;
  const hay = title.toLowerCase();
  if (!tokens.every((token) => hay.includes(token))) return -1;
  const phrase = query.trim().toLowerCase();
  const queryWantsAccessory = ACCESSORY_TERMS.some((term) => phrase.includes(term));
  if (!queryWantsAccessory) {
    for (const term of ACCESSORY_TERMS) {
      if (hay.includes(term)) return -1;
    }
    if (/\bfor\s+/.test(hay) && tokens.some((t) => hay.includes(`for ${t}`))) return -1;
  }
  let score = tokens.length * 10;
  if (phrase.length >= 2 && hay.includes(phrase)) score += 25;
  if (hay.startsWith(tokens[0]) || hay.startsWith(`new ${tokens[0]}`)) score += 10;
  return score;
}

const samples = {
  iPhone: [
    "Apple iPhone 15 Pro Max 256GB Unlocked",
    "Luxury Soft Case for iPhone 15",
    "iPhone Charger Cable USB-C",
    "Samsung Galaxy A15",
  ],
  "Samsung S24": [
    "Samsung Galaxy S24 Ultra 512GB",
    "Samsung S24 Clear Case",
    "Samsung Galaxy A54",
    "S24 Ultra Screen Protector",
  ],
  MacBook: [
    "Apple MacBook Air M3 13 inch",
    "MacBook Pro Stand Aluminum",
    "MacBook Air Case Sleeve",
    "Windows Laptop 15 inch",
  ],
  AirPods: [
    "Apple AirPods Pro 2nd Generation",
    "AirPods Case Cover Silicone",
    "Wireless Earbuds Bluetooth",
    "AirPods Charging Cable",
  ],
};

const out = {};
for (const [query, titles] of Object.entries(samples)) {
  out[query] = titles.map((title) => ({
    title,
    score: scoreTitleRelevance(title, query),
    keep: scoreTitleRelevance(title, query) >= 0,
  }));
}
console.log(JSON.stringify(out, null, 2));
