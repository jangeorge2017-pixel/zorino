import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const path = resolve(process.cwd(), ".env.local");
if (!existsSync(path)) {
  console.log(JSON.stringify({ exists: false }));
  process.exit(0);
}

const keys = {};
for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq === -1) continue;
  const key = t.slice(0, eq).trim();
  const val = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
  keys[key] = val ? `SET len=${val.length}` : "EMPTY";
}

const target = [
  "ALIEXPRESS_APP_KEY",
  "ALIEXPRESS_APP_SECRET",
  "ALIEXPRESS_TRACKING_ID",
];

console.log(
  JSON.stringify(
    {
      exists: true,
      allKeys: Object.keys(keys).sort(),
      aliexpress: Object.fromEntries(target.map((k) => [k, keys[k] ?? "MISSING"])),
    },
    null,
    2
  )
);
