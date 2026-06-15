import { createClient, setJwt } from "@/lib/supabase/client";

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)),
  ]);
}

/** Ensures the Supabase JWT is valid; refreshes if missing or expiring within 30 s.
 *  Never blocks the caller longer than ~8 s even if the network is dead. */
export async function ensureSession(): Promise<void> {
  const supabase = createClient();
  try {
    const { data: { session } } = await withTimeout(supabase.auth.getSession(), 3000);
    if (session?.access_token) setJwt(session.access_token);
    if (!session || (session.expires_at != null && Date.now() / 1000 + 30 > session.expires_at)) {
      const { data: { session: refreshed } } = await withTimeout(supabase.auth.refreshSession(), 5000);
      if (refreshed?.access_token) setJwt(refreshed.access_token);
    }
  } catch {
    // Proceed with the load anyway — the query itself will retry/fail fast.
  }
}

/** Runs a Supabase query; on error refreshes the session once and retries.
 *  Returns the row data, or null if both attempts fail. */
export async function withSessionRetry<T>(
  supabase: ReturnType<typeof createClient>,
  fn: () => PromiseLike<{ data: T | null; error: unknown }>
): Promise<T | null> {
  let result = await fn();
  if (result.error) {
    await supabase.auth.refreshSession();
    result = await fn();
  }
  return result.data;
}

/** Subscribes to postgres_changes for one table; returns an unsubscribe fn. */
export function subscribeTableChanges(
  channelName: string,
  table: string,
  filter: string,
  onChange: (eventType: string, newRow: unknown, oldRow: unknown) => void
): () => void {
  const supabase = createClient();
  const channel = supabase
    .channel(channelName)
    .on("postgres_changes", { event: "*", schema: "public", table, filter },
      (payload: { eventType: string; new: unknown; old: unknown }) => {
        onChange(payload.eventType, payload.new, payload.old);
      })
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}
