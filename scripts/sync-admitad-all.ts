import { runAdmitadIngestion } from "@/lib/integrations/admitad/ingestion";

function positiveEnvInt(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

async function main(): Promise<void> {
  const result = await runAdmitadIngestion({
    fullSweep: true,
    maxFeeds: Infinity,
    maxProductsPerFeed: positiveEnvInt("ADMITAD_MAX_PRODUCTS_PER_FEED", 5000),
    feedTimeoutMs: positiveEnvInt("ADMITAD_FEED_TIMEOUT_MS", 30_000),
    feedConcurrency: positiveEnvInt("ADMITAD_FEED_CONCURRENCY", 8),
    deadlineMs: positiveEnvInt("ADMITAD_FULL_DEADLINE_MS", 840_000),
  });

  console.log("[admitad-full-sweep] result:", JSON.stringify(result, null, 2));
  if (result.errors.length > 0 && result.productsSaved === 0) {
    process.exitCode = 1;
  }
}

void main().catch((error) => {
  console.error("[admitad-full-sweep] fatal:", error);
  process.exitCode = 1;
});
