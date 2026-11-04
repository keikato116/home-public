"use client";

// iOS アプリでのログインの経過を、端末の中だけに少し残す。
//
// TestFlight のアプリは Safari の Web インスペクタで中を覗けないので、
// 「Safari から戻ったのにログイン画面のまま」のような失敗は、理由が手元に何も残らない。
// 直近の数件だけ sessionStorage に置き、ログイン画面の下に小さく出す。
// 中身は出来事の名前とエラー文だけで、トークンやメールアドレスは入れない。

const KEY = "imbrex:auth-trace";
const MAX = 12;

export function traceAuth(message: string): void {
  try {
    const list = readAuthTrace();
    const time = new Date().toLocaleTimeString("ja-JP", { hour12: false });
    list.push(`${time} ${message}`);
    sessionStorage.setItem(KEY, JSON.stringify(list.slice(-MAX)));
  } catch {
    // 保存できなくても、ログイン自体には関係ない
  }
}

export function readAuthTrace(): string[] {
  try {
    const raw = sessionStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.map(String) : [];
  } catch {
    return [];
  }
}
