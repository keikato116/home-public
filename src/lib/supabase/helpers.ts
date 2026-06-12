import { createClient } from "@/lib/supabase/client";

/** Ensures the Supabase JWT is valid; refreshes if missing or expiring within 30 s. */
export async function ensureSession(): Promise<void> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session || (session.expires_at != null && Date.now() / 1000 + 30 > session.expires_at)) {
    await supabase.auth.refreshSession().catch(() => {});
  }
}

/** Runs a Supabase query; on error refreshes the session once and retries.
 *  Returns the row data, or null if both attempts fail. */
export async function withSessionRetry<T>(
  supabase: ReturnType<typeof createClient>,
  fn: () => Promise<{ data: T | null; error: unknown }>
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
