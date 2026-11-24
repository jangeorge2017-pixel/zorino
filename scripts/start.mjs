import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const standaloneServer = join(process.cwd(), ".next", "standalone", "server.js");
if (!existsSync(standaloneServer)) {
  console.error(`[start] standalone server not found at ${standaloneServer}`);
  process.exit(1);
}

const nodeOptions = "--max-old-space-size=256";

const child = spawn(process.execPath, [standaloneServer], {
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_OPTIONS: nodeOptions,
    HOSTNAME: "0.0.0.0",
  },
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
