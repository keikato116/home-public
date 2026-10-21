import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * ログインしていなければ 401 を返す。返り値が null なら通してよい。
 * 外部の有料 API（天気・Google）を呼ぶ口や、サーバーに URL を取りに行かせる口を、
 * ログインしていない人に使わせないため。
 */
export async function requireUser(): Promise<NextResponse | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user ? null : NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

/**
 * 有料機能の API を守る。
 *
 * 返り値が null なら通してよい。NextResponse が返ったらそれをそのまま返す。
 *
 * クライアント側のタブ非表示だけでは、AI 解析のような「呼ぶたびに金がかかる」
 * エンドポイントは守れない（URL を直接叩けば誰でも使える）ので、サーバー側でも判定する。
 */
export async function requireEntitled(): Promise<NextResponse | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase.rpc("household_entitled");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (data !== true) {
    return NextResponse.json({ error: "subscription required" }, { status: 402 });
  }
  return null;
}
