import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

// 利用者が入れた URL をサーバーから取りに行くときの入口（レシピの取り込み）。
//
// そのまま fetch すると、サーバーを踏み台にして内部のアドレス（127.0.0.1、
// 169.254.169.254 のメタデータ、社内 LAN など）を叩かせられる（SSRF）。
// ここでは http/https のみ、名前解決した先がすべて公開アドレスであること、
// リダイレクト先も同じ確認を通ること、時間と大きさの上限、を守らせる。

const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 10_000;
const MAX_BYTES = 3 * 1024 * 1024;

/** 外に出してはいけないアドレスか（ループバック・プライベート・リンクローカルなど）。 */
export function isPrivateAddress(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||   // CGNAT
      (a === 169 && b === 254) ||             // リンクローカル（クラウドのメタデータ）
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224                                 // マルチキャスト・予約
    );
  }
  if (v === 6) {
    const s = ip.toLowerCase();
    if (s === "::" || s === "::1") return true;
    // IPv4 射影（::ffff:127.0.0.1）は中の IPv4 で判定する
    const mapped = s.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return (
      s.startsWith("fc") || s.startsWith("fd") ||   // ユニークローカル
      s.startsWith("fe8") || s.startsWith("fe9") || s.startsWith("fea") || s.startsWith("feb") || // リンクローカル
      s.startsWith("ff")                             // マルチキャスト
    );
  }
  return true; // IP として読めないものは通さない
}

async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("invalid url");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("unsupported protocol");
  if (url.username || url.password) throw new Error("credentials in url");

  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host)
    ? [host]
    : (await lookup(host, { all: true })).map((a) => a.address);
  if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
    throw new Error("blocked address");
  }
  return url;
}

/** 公開されているページの本文（HTML）を取る。だめなら throw。 */
export async function fetchPublicText(raw: string, headers: Record<string, string> = {}): Promise<string> {
  let url = await assertPublicUrl(raw);
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
  try {
    for (let hop = 0; ; hop++) {
      const res = await fetch(url, { headers, redirect: "manual", signal: abort.signal, cache: "no-store" });
      if (res.status >= 300 && res.status < 400) {
        const next = res.headers.get("location");
        if (!next || hop >= MAX_REDIRECTS) throw new Error("too many redirects");
        url = await assertPublicUrl(new URL(next, url).toString());
        continue;
      }
      if (!res.ok || !res.body) throw new Error(`fetch failed (${res.status})`);

      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_BYTES) {
          await reader.cancel();
          break; // 先頭だけで足りる（タイトルと本文の冒頭しか使わない）
        }
        chunks.push(value);
      }
      return new TextDecoder().decode(Buffer.concat(chunks));
    }
  } finally {
    clearTimeout(timer);
  }
}
