import { fileURLToPath } from "node:url";

const RENDER = process.env.RENDER === "true";
const DISABLED = process.env.DISABLE_PLAYWRIGHT === "true";

if (RENDER || DISABLED) {
  throw new Error(
    `[browser-guard] headless browsers are disabled on Render/production (${fileURLToPath(import.meta.url)})`,
  );
}
