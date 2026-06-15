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

// Module-level JWT cache. Updated by authStore on sign-in / token refresh.
// Used by the accessToken patch below to bypass per-request getSession() calls.
let _jwt: string | null = null;

export function setJwt(token: string) {
  _jwt = token;
}

// createBrowserClient already manages its own internal singleton (cachedBrowserClient),
// so subsequent calls return the same instance regardless of options passed.
// We call it once here to ensure the lock option is applied on first creation.
export function createClient() {
  const client = createBrowserClient(
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

  // Patch client.accessToken so DB/storage fetches (fetchWithAuth → _getAccessToken) use
  // the cached JWT instead of calling auth.getSession() on every request.
  // Without this patch: each upload/insert calls getSession() which queues behind the
  // GoTrueClient lockAcquired flag. On iOS resume with a dead connection + expired token,
  // 8 parallel uploads serialise to 8 × 30 s = 240 s → "save timed out".
  // With this patch: DB/storage fetches never touch the auth lock at all.
  // Saves fail fast (401 / 403) if the JWT is stale rather than hanging for 2 minutes.
  const c = client as unknown as Record<string, unknown>;
  if (!c._jwtPatched) {
    c.accessToken = async () => _jwt;
    c._jwtPatched = true;
  }

  return client;
}
