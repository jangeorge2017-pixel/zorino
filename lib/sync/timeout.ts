export type TimeoutResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export const QUERY_TIMEOUT_MS = 20_000;
export const STORE_TIMEOUT_MS = 180_000;

function positiveIntEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

export const GLOBAL_TIMEOUT_MS = positiveIntEnv(
  "SYNC_GLOBAL_TIMEOUT_MS",
  11 * 60 * 1000,
);

export async function withTimeout<T>(
  label: string,
  work: Promise<T>,
  timeoutMs: number,
): Promise<TimeoutResult<T>> {
  const duration = Math.max(1, Math.floor(timeoutMs));
  let timer: ReturnType<typeof setTimeout> | undefined;

  const expired = new Promise<TimeoutResult<T>>((resolve) => {
    timer = setTimeout(() => {
      console.warn(`[sync-timeout] ${label} exceeded ${duration}ms; moving on`);
      resolve({ ok: false, error: `timeout-${duration}ms` });
    }, duration);
  });

  try {
    return await Promise.race([
      work.then(
        (value) => ({ ok: true as const, value }),
        (error) => ({
          ok: false as const,
          error: error instanceof Error ? error.message.slice(0, 200) : String(error),
        }),
      ),
      expired,
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
