#!/usr/bin/env node
//
// Sign in with Apple の client secret（JWT）を作る。
//
// Supabase の Authentication → Providers → Apple の「Secret Key (for OAuth)」に
// 入れるのは .p8 の中身ではなく、.p8 で署名した JWT。
//
//   使い方:
//     node scripts/apple-client-secret.mjs \
//       --p8 ~/Downloads/AuthKey_XXXXXXXXXX.p8 \
//       --team-id XXXXXXXXXX \
//       --key-id XXXXXXXXXX \
//       --services-id com.keikato.homeapp.signin
//
// 【6ヶ月ごとに実行すること】
// Apple の仕様で、この JWT は発行から最長6ヶ月しか使えない。
// 切れると Apple ログインが全員できなくなる。カレンダーに繰り返しの予定を入れておく。
// .p8 のほうは期限が無いので、鍵を作り直す必要はない。同じ .p8 で何度でも作れる。
//
// 依存は無し（Node の crypto だけ）。秘密鍵を外部に渡さないよう、
// あえてライブラリを使っていない。

import { readFileSync } from "node:fs";
import { createSign } from "node:crypto";

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

const p8Path = arg("p8");
const teamId = arg("team-id");
const keyId = arg("key-id");
const servicesId = arg("services-id");
// Apple の上限は6ヶ月。既定はその手前にして、期限ぎりぎりを避ける
const days = Number(arg("days") ?? 180);

const missing = [
  ["--p8", p8Path],
  ["--team-id", teamId],
  ["--key-id", keyId],
  ["--services-id", servicesId],
].filter(([, v]) => !v).map(([k]) => k);

if (missing.length > 0) {
  console.error(`必要な指定が足りません: ${missing.join(", ")}

  node scripts/apple-client-secret.mjs \\
    --p8 ~/Downloads/AuthKey_XXXXXXXXXX.p8 \\
    --team-id XXXXXXXXXX \\
    --key-id XXXXXXXXXX \\
    --services-id com.keikato.homeapp.signin

  Team ID      : Apple Developer の右上（Membership）にある10文字
  Key ID       : Keys で鍵を作ったときの10文字。ファイル名にも入っている
                 （AuthKey_XXXXXXXXXX.p8 の XXXXXXXXXX）
  Services ID  : Identifiers → Services IDs で作った識別子
`);
  process.exit(1);
}

if (days > 180) {
  console.error("Apple の上限は6ヶ月（180日）です。--days は180以下にしてください。");
  process.exit(1);
}

let privateKey;
try {
  privateKey = readFileSync(p8Path, "utf8");
} catch {
  console.error(`.p8 を読めません: ${p8Path}`);
  process.exit(1);
}

if (!privateKey.includes("BEGIN PRIVATE KEY")) {
  console.error(".p8 の中身に見えません。Apple の Keys からダウンロードしたファイルを指定してください。");
  process.exit(1);
}

const now = Math.floor(Date.now() / 1000);
const exp = now + days * 24 * 60 * 60;

const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");

const header = b64url({ alg: "ES256", kid: keyId, typ: "JWT" });
const payload = b64url({
  iss: teamId,          // 発行者は Team
  iat: now,
  exp,
  aud: "https://appleid.apple.com",
  sub: servicesId,      // 対象は Services ID
});

// ES256 の署名は R||S の生バイト列（ieee-p1363）。
// 既定の DER 形式にすると Apple に invalid_client で弾かれる。
const signer = createSign("SHA256");
signer.update(`${header}.${payload}`);
const signature = signer
  .sign({ key: privateKey, dsaEncoding: "ieee-p1363" })
  .toString("base64url");

const jwt = `${header}.${payload}.${signature}`;

const until = new Date(exp * 1000).toLocaleDateString("ja-JP", {
  year: "numeric", month: "long", day: "numeric",
});

console.log(`
Supabase → Authentication → Providers → Apple → Secret Key (for OAuth)
に、次の1行を貼ってください。

${jwt}

有効期限: ${until}
それまでに、このスクリプトをもう一度実行して貼り替えること。
切れると Apple ログインが全員できなくなります。
`);
