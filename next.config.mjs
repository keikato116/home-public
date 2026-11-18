// 画面を守るためのヘッダー。
//
// このアプリはログインの鍵（Supabase のセッション）と Google のトークンを、画面のスクリプトから
// 読める場所に置いている。もし画面に悪意のあるスクリプトを差し込まれる穴があると、それらを
// まとめて持っていかれる。CSP で「読み込んでよいもの・送ってよい先」を絞り、穴があっても
// 外へ持ち出しにくくしておく。
//
// 送り先を足したら（新しい外部サービスを画面から直接呼ぶなど）、ここも足すこと。
// 足し忘れると、その通信だけがブラウザに止められる（開発者ツールに CSP の違反が出る）。
const csp = [
  "default-src 'self'",
  // Next.js は起動用のスクリプトを HTML に埋め込むので 'unsafe-inline' が要る。
  // 外部のスクリプトと eval は許さない。
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  // レシピの写真（Supabase の署名付き URL と、端末に控えた blob:）と天気のアイコン
  "img-src 'self' data: blob: https://*.supabase.co https://openweathermap.org",
  "font-src 'self' data:",
  // 画面から直接話す相手は Supabase だけ（Google・Claude・天気はサーバー経由）
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  // 他のサイトに埋め込ませない（アカウント削除などのボタンを、透明な枠越しに押させる攻撃の対策）
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=()" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { hostname: "openweathermap.org" },
      { hostname: "*.supabase.co" },
    ],
  },
  async headers() {
    // 開発中の画面は eval を使うので、CSP は本番のビルドにだけ付ける
    const headers =
      process.env.NODE_ENV === "production"
        ? [...securityHeaders, { key: "Content-Security-Policy", value: csp }]
        : securityHeaders;
    return [{ source: "/:path*", headers }];
  },
};

export default nextConfig;
