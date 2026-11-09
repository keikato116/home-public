import type { Metadata, Viewport } from "next";
import { DM_Mono } from "next/font/google";
import "./globals.css";

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  // 同じページが imbrex.app・www.imbrex.app・vercel.app・workers.dev の複数の URL で
  // 見えるので、Google に「正しいのはこれ」と伝える（Search Console の
  // 「重複しています。ユーザーにより、正規ページとして選択されていません」の対策）。
  // canonical はページごとに上書きする。ここの "/" はトップ（ログイン画面）の分。
  metadataBase: new URL("https://imbrex.app"),
  alternates: { canonical: "/" },
  title: "Imbrex",
  description: "household task sharing app",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Imbrex",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f7f4" },
    { media: "(prefers-color-scheme: dark)", color: "#141414" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className={dmMono.variable}>
      <body>{children}</body>
    </html>
  );
}
