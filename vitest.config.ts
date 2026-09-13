import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["node_modules", ".next", "scripts", "cai"],
    pool: "forks",
    poolOptions: {
      forks: {
        isolate: false,
        singleFork: true,
      },
    },
    coverage: {
      provider: "v8",
      include: ["lib/providers/**"],
      exclude: ["node_modules", ".next"],
    },
  },
});
