import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const nextBin = join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
if (!existsSync(nextBin)) {
  console.error(`[start] next binary not found at ${nextBin}`);
  process.exit(1);
}

const maxOldSpace = "--max-old-space-size=320";
const inherited = process.env.NODE_OPTIONS?.trim();
const nodeOptions = inherited ? `${inherited} ${maxOldSpace}` : maxOldSpace;

const child = spawn(process.execPath, [nextBin, "start"], {
  stdio: "inherit",
  env: { ...process.env, NODE_OPTIONS: nodeOptions },
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
