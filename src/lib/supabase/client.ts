import { createBrowserClient } from "@supabase/ssr";

// createBrowserClient already manages its own internal singleton (cachedBrowserClient),
// so subsequent calls return the same instance regardless of options passed.
// We call it once here to ensure the lock option is applied on first creation.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // Bypass navigator.locks. On iOS PWA, background suspension can orphan a lock request;
        // when the app resumes all queued Supabase operations hang until a page reload.
        // This app is single-tab so cross-tab locking is unnecessary.
        lock: <R>(_name: string, _timeout: number, fn: () => Promise<R>): Promise<R> => fn(),
      },
    }
  );
}
