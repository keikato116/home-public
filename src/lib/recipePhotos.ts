"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// レシピ写真は非公開のバケットに置いてある（2026-10-28_private_recipe_photos.sql）。
// 見られるのは持ち主と、同じ世帯にいる間の相手だけ。端末に無い写真は、期限つきの
// URL を発行してもらってダウンロードする。URL が他人に渡っても、期限（1時間）が
// 切れれば見られない。一度ダウンロードした写真は端末に保存して使い回す（下記）。
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

// ── 端末への保存 ────────────────────────────────────────────────
// 一度読み込んだ写真は端末（Cache Storage）に保存して使い回す。期限つき URL は
// 発行のたびに変わるので、ブラウザの通常のキャッシュでは同じ写真と分からず、
// アプリを開き直すたびに全部ダウンロードし直していた（転送量・速さ・通信量）。
// キーは写真の置き場所（パス）にする。
//
// 端末に残さないとき:
//   - ログアウト・アカウント削除 → 全部消す（clearRecipePhotoCache）
//   - 一覧に無くなった写真（削除したレシピ、世帯を抜けた相手の写真）
//     → 一覧を読み込むたびに消す（pruneRecipePhotoCache）

const DEVICE_CACHE = "recipe-photos-v1";
const KEY_PREFIX = "/__recipe-photo/";

/** 端末キャッシュのキー（同じオリジンの架空の URL）。パスから一意に決まる */
export function deviceCacheKey(origin: string, path: string): string {
  return `${origin}${KEY_PREFIX}${encodeURIComponent(path)}`;
}

/** キャッシュのキーからパスを戻す。この仕組みのキーでなければ null */
export function pathOfDeviceCacheKey(key: string): string | null {
  const i = key.indexOf(KEY_PREFIX);
  return i < 0 ? null : decodeURIComponent(key.slice(i + KEY_PREFIX.length));
}

function deviceCacheAvailable(): boolean {
  return typeof window !== "undefined" && "caches" in window;
}

// 同じ写真に何度も createObjectURL しない（メモリが増え続けるので）
const objectUrls = new Map<string, string>();
const inflight = new Map<string, Promise<string | null>>();

async function fromDevice(path: string): Promise<string | null> {
  if (!deviceCacheAvailable()) return null;
  try {
    const store = await caches.open(DEVICE_CACHE);
    const hit = await store.match(deviceCacheKey(window.location.origin, path));
    if (!hit) return null;
    const url = URL.createObjectURL(await hit.blob());
    objectUrls.set(path, url);
    return url;
  } catch {
    return null;
  }
}

async function downloadAndKeep(path: string): Promise<string | null> {
  const signed = await signedUrlFor(path);
  if (!signed) return null;
  if (!deviceCacheAvailable()) return signed;
  try {
    const res = await fetch(signed);
    if (!res.ok) return signed;
    const blob = await res.blob();
    const store = await caches.open(DEVICE_CACHE);
    await store.put(
      deviceCacheKey(window.location.origin, path),
      new Response(blob, { headers: { "Content-Type": blob.type || "image/jpeg" } })
    );
    const url = URL.createObjectURL(blob);
    objectUrls.set(path, url);
    return url;
  } catch {
    // 取りに行けなかった（通信・CORS など）。期限つき URL をそのまま使う
    return signed;
  }
}

/** 端末にあればそれを、無ければダウンロードして端末に保存したものを返す */
function photoUrlFor(path: string): Promise<string | null> {
  const known = objectUrls.get(path);
  if (known) return Promise.resolve(known);
  let p = inflight.get(path);
  if (!p) {
    p = (async () => (await fromDevice(path)) ?? (await downloadAndKeep(path)))();
    inflight.set(path, p);
    p.finally(() => inflight.delete(path));
  }
  return p;
}

/** 端末に保存した写真を全部消す。ログアウト・アカウント削除のときに呼ぶ */
export async function clearRecipePhotoCache(): Promise<void> {
  objectUrls.forEach((u) => URL.revokeObjectURL(u));
  objectUrls.clear();
  cache.clear();
  if (!deviceCacheAvailable()) return;
  try {
    await caches.delete(DEVICE_CACHE);
  } catch {
    // 消せなくてもサインアウトは止めない
  }
}

/** 保存してある写真のうち、keep に無いものを消す（一覧に出なくなった写真） */
export function pathsToEvict(cachedPaths: string[], keep: Set<string>): string[] {
  return cachedPaths.filter((p) => !keep.has(p));
}

/** 一覧を読み込んだあとに呼ぶ。urls はいま見えているレシピの写真すべて */
export async function pruneRecipePhotoCache(urls: (string | null | undefined)[]): Promise<void> {
  if (!deviceCacheAvailable()) return;
  const keep = new Set(urls.map(storagePathOf).filter((p): p is string => !!p));
  try {
    const store = await caches.open(DEVICE_CACHE);
    const keys = await store.keys();
    const cached = keys.map((r) => pathOfDeviceCacheKey(r.url)).filter((p): p is string => !!p);
    for (const path of pathsToEvict(cached, keep)) {
      await store.delete(deviceCacheKey(window.location.origin, path));
      const u = objectUrls.get(path);
      if (u) { URL.revokeObjectURL(u); objectUrls.delete(path); }
    }
  } catch {
    // 掃除できなくても表示には影響しない
  }
}

/**
 * 表示に使う URL。ここのストレージの写真なら、端末に保存したもの（無ければダウンロード
 * して保存したもの）に置き換える。取得中は null。どうしても取れなければ元の URL を返す
 * （非公開のバケットでは見られないが、他人の写真が出ることはない）。
 */
export function useRecipePhoto(url: string | null | undefined): string | null {
  const path = storagePathOf(url);
  const [resolved, setResolved] = useState<string | null>(() => {
    if (!url) return null;
    if (!path) return url;
    return objectUrls.get(path) ?? null;
  });

  useEffect(() => {
    if (!url) { setResolved(null); return; }
    if (!path) { setResolved(url); return; }
    let cancelled = false;
    photoUrlFor(path).then((u) => {
      if (!cancelled) setResolved(u ?? url);
    });
    return () => { cancelled = true; };
  }, [url, path]);

  return resolved;
}
