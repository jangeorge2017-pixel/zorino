import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";

const nextBin = join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
if (!existsSync(nextBin)) {
  console.error(`[build] next binary not found at ${nextBin}`);
  process.exit(1);
}

const env = {
  ...process.env,
  NODE_OPTIONS: "--max-old-space-size=320",
  NEXT_TELEMETRY_DISABLED: "1",
};

console.log(
  "[build] next build with NODE_OPTIONS=--max-old-space-size=320 NEXT_TELEMETRY_DISABLED=1",
);
const result = spawnSync(process.execPath, [nextBin, "build"], { stdio: "inherit", env });
if (result.error) {
  console.error("[build] next build failed to start:", result.error);
  process.exit(1);
}
if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

function copyDirectory(source, target) {
  if (!existsSync(source)) throw new Error(`Missing ${source}`);
  mkdirSync(dirname(target), { recursive: true });
  rmSync(target, { recursive: true, force: true });
  cpSync(source, target, { recursive: true });
}

try {
  const standaloneServer = join(process.cwd(), ".next", "standalone", "server.js");
  if (!existsSync(standaloneServer)) throw new Error(`Missing ${standaloneServer}`);

  copyDirectory(
    join(process.cwd(), ".next", "static"),
    join(process.cwd(), ".next", "standalone", ".next", "static"),
  );
  const publicDir = join(process.cwd(), "public");
  if (existsSync(publicDir)) {
    copyDirectory(publicDir, join(process.cwd(), ".next", "standalone", "public"));
  } else {
    console.warn("[build] public/ not found; skipping standalone public copy");
  }
  console.log("[build] standalone static/public assets copied");
} catch (error) {
  console.error("[build] standalone asset copy failed:", error);
  process.exit(1);
}
