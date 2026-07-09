import { readFileSync, existsSync } from "node:fs";
import { resolve, relative, join } from "node:path";

const cwd = process.cwd();
const roots = [cwd, resolve(cwd, ".."), resolve(cwd, "../.."), resolve(cwd, "../../..")];
const names = [".env.local", ".env", ".env.development.local", ".env.development"];

function parseEnv(filePath) {
  const keys = {};
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    keys[k] = v;
  }
  return keys;
}

function isSet(v) {
  if (!v || !v.trim()) return false;
  if (/^<.*>$/.test(v.trim())) return false;
  if (/paste|your-/i.test(v.trim())) return false;
  return true;
}

const files = [];
const seen = new Set();

for (const root of roots) {
  for (const name of names) {
    const p = join(root, name);
    if (!existsSync(p) || seen.has(p)) continue;
    seen.add(p);
    const keys = parseEnv(p);
    const app = keys.ALIEXPRESS_APP_KEY ?? "";
    const secret = keys.ALIEXPRESS_APP_SECRET ?? "";
    files.push({
      path: p,
      relativeToCwd: relative(cwd, p) || ".",
      hasAppKey: isSet(app),
      hasAppSecret: isSet(secret),
      appKeyLen: app.trim().length,
      appSecretLen: secret.trim().length,
      keyNames: Object.keys(keys).sort(),
    });
  }
}

// Next.js loads .env* from project root (cwd when running next dev).
const projectEnvLocal = resolve(cwd, ".env.local");
const projectFile = files.find((f) => f.path === projectEnvLocal);

console.log(
  JSON.stringify(
    {
      projectRoot: cwd,
      nextJsLoadsFrom: projectEnvLocal,
      projectEnvLocalExists: existsSync(projectEnvLocal),
      projectEnvLocalAliExpress: projectFile
        ? {
            hasAppKey: projectFile.hasAppKey,
            hasAppSecret: projectFile.hasAppSecret,
            appKeyLen: projectFile.appKeyLen,
            appSecretLen: projectFile.appSecretLen,
            allKeys: projectFile.keyNames,
          }
        : null,
      allEnvFilesFound: files,
    },
    null,
    2
  )
);
