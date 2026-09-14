import type { CapacitorConfig } from "@capacitor/cli";
import { config as loadEnv } from "dotenv";

// cap コマンドは Next.js とは別のプロセスなので、.env.local を自分では読まない。
// ここで読んでおかないと CAP_SERVER_URL が undefined のままになり、
// アプリが Vercel を見に行かず、capacitor-shell の「設定が足りません」が出る。
loadEnv({ path: ".env.local" });

// The app has server-side API routes (/api/parse-recipe, /api/calendar, …), so it cannot
// be exported as static files. Instead the native shell loads the deployed Next.js app.
// Upside: shipping a web change is still just `git push` — no Xcode rebuild needed.
// Set CAP_SERVER_URL in .env.local (or the shell) to your deployment, e.g.
//   CAP_SERVER_URL=https://homes-xxxx.vercel.app
const serverUrl = process.env.CAP_SERVER_URL;

const config: CapacitorConfig = {
  // App Store 公開版の Bundle ID。TestFlight で配っている内輪版（com.keikato.home）とは
  // 別のアプリとして登録するため、意図的に別 ID にしている。
  // App Store Connect 側の App ID とここは必ず一致させること。
  appId: "com.keikato.homeapp",
  appName: "Imbrex",
  // ネイティブシェルは server.url（Vercel）を読むので、ここの中身は普段使われない。
  // ただし Capacitor は webDir に index.html があることを要求するので、専用の
  // フォルダを1つ置いてある。Next.js の public/ を指すと index.html が無くて
  // `cap add ios` が落ちる。
  //
  // CAP_SERVER_URL が未設定のままビルドすると server が undefined になり、
  // この中身が実際に表示される。白画面ではなく理由が出るようにしてある。
  webDir: "capacitor-shell",
  server: serverUrl
    ? { url: serverUrl, cleartext: false }
    : undefined,
  ios: {
    // Match the PWA background so the launch/overscroll area doesn't flash white.
    backgroundColor: "#f8f7f4",
    contentInset: "always",
  },
};

export default config;
