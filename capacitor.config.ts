import type { CapacitorConfig } from "@capacitor/cli";

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
  appName: "home",
  webDir: "public",
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
