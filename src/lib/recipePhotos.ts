"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// レシピ写真は非公開のバケットに置いてある（2026-10-28_private_recipe_photos.sql）。
// 見られるのは持ち主と、同じ世帯にいる間の相手だけ。表示のたびに期限つきの URL を
// 発行する。URL が他人に渡っても、期限（1時間）が切れれば見られない。
//
// DB には公開 URL の形（…/object/public/recipes/<path>）のまま入っている。
// 非公開にする前に保存したものとの互換のためで、ここではパスを取り出すのに使うだけ。

const BUCKET = "recipes";
const EXPIRES_IN = 60 * 60;          // 1時間
const REFRESH_BEFORE_MS = 10 * 60e3; // 切れる10分前には取り直す

/** 保存されている URL からバケット内のパスを取り出す。ここのストレージでなければ null。 */
export function storagePathOf(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/\/storage\/v1\/object\/(?:public|sign)\/recipes\/([^?#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

const cache = new Map<string, { url: string; expiresAt: number }>();
let queue = new Map<string, ((url: string | null) => void)[]>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

async function flush() {
  flushTimer = null;
  const batch = queue;
  queue = new Map();
  const paths = Array.from(batch.keys());
  let signed: { path: string | null; signedUrl: string | null }[] = [];
  try {
    const { data } = await createClient().storage.from(BUCKET).createSignedUrls(paths, EXPIRES_IN);
    signed = (data ?? []) as typeof signed;
  } catch {
    // 下で全部 null として返す
  }
  const byPath = new Map(signed.filter((s) => s.path && s.signedUrl).map((s) => [s.path!, s.signedUrl!]));
  const expiresAt = Date.now() + EXPIRES_IN * 1000;
  batch.forEach((resolvers, path) => {
    const url = byPath.get(path) ?? null;
    if (url) cache.set(path, { url, expiresAt });
    resolvers.forEach((r) => r(url));
  });
}

/** パスの期限つき URL。同じ描画のあいだの要求はまとめて1回で取りに行く。 */
function signedUrlFor(path: string): Promise<string | null> {
  const hit = cache.get(path);
  if (hit && hit.expiresAt - Date.now() > REFRESH_BEFORE_MS) return Promise.resolve(hit.url);
  return new Promise((resolve) => {
    const list = queue.get(path) ?? [];
    list.push(resolve);
    queue.set(path, list);
    if (!flushTimer) flushTimer = setTimeout(flush, 0);
  });
}

/**
 * 表示に使う URL。ここのストレージの写真なら期限つき URL に置き換える。
 * 取得中は null。発行できなかったら元の URL を返す（バケットを非公開にする前は
 * それで表示できる。非公開にしたあとは見られないが、他人の写真が出ることはない）。
 */
export function useRecipePhoto(url: string | null | undefined): string | null {
  const path = storagePathOf(url);
  const [resolved, setResolved] = useState<string | null>(() => {
    if (!url) return null;
    if (!path) return url;
    const hit = cache.get(path);
    return hit && hit.expiresAt - Date.now() > REFRESH_BEFORE_MS ? hit.url : null;
  });

  useEffect(() => {
    if (!url) { setResolved(null); return; }
    if (!path) { setResolved(url); return; }
    let cancelled = false;
    signedUrlFor(path).then((signed) => {
      if (!cancelled) setResolved(signed ?? url);
    });
    return () => { cancelled = true; };
  }, [url, path]);

  return resolved;
}
