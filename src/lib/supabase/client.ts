import { createBrowserClient } from "@supabase/ssr";

// iOS kills idle TCP connections while the PWA is suspended. After resume, a fetch
// over a dead connection can hang forever (no error, no response), leaving stores
// stuck at loading. Abort after 15 s so callers fail fast and can retry.
const fetchWithTimeout: typeof fetch = (input, init = {}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  return fetch(input, { ...init, signal: init.signal ?? controller.signal })
    .finally(() => clearTimeout(timer));
};

// createBrowserClient already manages its own internal singleton (cachedBrowserClient),
// so subsequent calls return the same instance regardless of options passed.
// We call it once here to ensure the lock option is applied on first creation.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { fetch: fetchWithTimeout },
      auth: {
        // Bypass navigator.locks. On iOS PWA, background suspension can orphan a lock request;
        // when the app resumes all queued Supabase operations hang until a page reload.
        // This app is single-tab so cross-tab locking is unnecessary.
        lock: <R>(_name: string, _timeout: number, fn: () => Promise<R>): Promise<R> => fn(),
      },
    }
  );
}
