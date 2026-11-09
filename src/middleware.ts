import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// 検索に載せるのは imbrex.app だけ。
//   ・www.imbrex.app は imbrex.app へ恒久的に転送する
//   ・vercel.app / workers.dev は、古い iPhone アプリと動作確認のためにまだ動かしているので
//     転送はせず（ログインの戻り先が変わってしまう）、検索に載せないよう伝えるだけにする
const PRIMARY_HOST = "imbrex.app";

export async function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? "";

  if (host === `www.${PRIMARY_HOST}`) {
    const url = request.nextUrl.clone();
    url.protocol = "https:";
    url.host = PRIMARY_HOST;
    url.port = "";
    return NextResponse.redirect(url, 301);
  }

  const response = await updateSession(request);
  if (host !== PRIMARY_HOST) {
    response.headers.set("X-Robots-Tag", "noindex");
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
