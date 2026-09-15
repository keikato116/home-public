import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Google のトークンを保存する前に暗号化する。
//
// 鍵は Supabase の外（Vercel の環境変数）に置く。DB のダンプが流出しても、
// 鍵が一緒に漏れない限りトークンは使えない。
//
// **これで防げるのは「DB だけが漏れたとき」。** Vercel と Supabase の両方を
// 持っている運営者からは守れない。サーバーが相手のカレンダーを代理で取りに行く
// 構造上、サーバーは平文のトークンを扱う必要があるため。そこまで隠すには
// 端末間の暗号化が要り、鍵を失うと復旧できなくなる代償がつく。
//
// 暗号化・復号はサーバーでのみ行う。ブラウザに鍵を渡したら意味が無いので、
// トークンの読み書きは /api/tokens を通す。

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12; // GCM の推奨
const PREFIX = "v1";

/**
 * 暗号化済みの値かどうか。
 * 暗号化を入れる前に保存された行は平文で入っているので、読む側は
 * 両方を受け付ける必要がある（次に書かれた時点で暗号文になる）。
 */
function isEncrypted(value: string): boolean {
  return value.startsWith(`${PREFIX}.`);
}

function key(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    // 黙って平文で保存するくらいなら落ちたほうがよい。設定漏れに気づけない
    // まま「暗号化したつもり」で運用するのが一番まずい。
    throw new Error(
      "TOKEN_ENCRYPTION_KEY が設定されていません。" +
      "`openssl rand -base64 32` で作り、Vercel の環境変数に入れてください。"
    );
  }
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error(
      `TOKEN_ENCRYPTION_KEY は base64 の32バイトである必要があります（いまは ${buf.length} バイト）。`
    );
  }
  return buf;
}

/** 保存用の文字列にする。空文字は空文字のまま返す（「未設定」を壊さないため）。 */
export function encryptToken(plain: string): string {
  if (plain === "") return "";
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    PREFIX,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

/**
 * 保存されている値を平文に戻す。
 * 暗号化前に保存された平文はそのまま返す。復号に失敗したら空文字を返す
 * （鍵を入れ替えた直後など。ここで例外を投げると、カレンダー全体が
 * 表示されなくなるより静かに「未連携」に倒れるほうが被害が小さい）。
 */
export function decryptToken(stored: string | null | undefined): string {
  if (!stored) return "";
  if (!isEncrypted(stored)) return stored;

  const parts = stored.split(".");
  if (parts.length !== 4) return "";
  const [, ivB64, tagB64, ctB64] = parts;

  try {
    const decipher = createDecipheriv(ALGORITHM, key(), Buffer.from(ivB64, "base64url"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(ctB64, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return "";
  }
}
