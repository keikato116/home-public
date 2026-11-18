import { NextResponse } from "next/server";

/**
 * サーバー内部の失敗を 500 で返す。
 *
 * データベースやストレージのエラー文には、表・列・制約の名前が入っている。
 * 利用者に返すと、どこを狙えばよいかの手がかりになるので、中身はログ
 * （Cloudflare の Observability）にだけ残し、返すのは決まった文言にする。
 */
export function internalError(tag: string, detail: unknown, message = "internal error"): NextResponse {
  console.error(`[${tag}]`, detail instanceof Error ? detail.message : detail);
  return NextResponse.json({ error: message }, { status: 500 });
}
