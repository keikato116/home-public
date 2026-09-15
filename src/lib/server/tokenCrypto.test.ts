import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { encryptToken, decryptToken } from "./tokenCrypto";

const KEY = Buffer.alloc(32, 7).toString("base64");
const OTHER_KEY = Buffer.alloc(32, 9).toString("base64");

beforeEach(() => { process.env.TOKEN_ENCRYPTION_KEY = KEY; });
afterEach(() => { delete process.env.TOKEN_ENCRYPTION_KEY; });

describe("encryptToken / decryptToken", () => {
  it("往復する", () => {
    const token = "1//0eXAMPLE-refresh-token";
    expect(decryptToken(encryptToken(token))).toBe(token);
  });

  it("暗号文に平文が現れない", () => {
    const token = "1//0eXAMPLE-refresh-token";
    expect(encryptToken(token)).not.toContain(token);
  });

  it("同じ入力でも毎回違う暗号文になる（IV が使われている）", () => {
    expect(encryptToken("same")).not.toBe(encryptToken("same"));
  });

  it("空文字は空文字のまま。未設定を壊さない", () => {
    expect(encryptToken("")).toBe("");
    expect(decryptToken("")).toBe("");
    expect(decryptToken(null)).toBe("");
  });

  it("暗号化前に保存された平文はそのまま読める", () => {
    // 既存の行は平文。移行スクリプトを流さずに読めるようにしてある。
    expect(decryptToken("ya29.legacy-plaintext")).toBe("ya29.legacy-plaintext");
  });

  it("改ざんされたら空文字（GCM の認証タグが効いている）", () => {
    const enc = encryptToken("secret");
    const parts = enc.split(".");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(decryptToken(parts.join("."))).toBe("");
  });

  it("別の鍵では復号できない", () => {
    const enc = encryptToken("secret");
    process.env.TOKEN_ENCRYPTION_KEY = OTHER_KEY;
    expect(decryptToken(enc)).toBe("");
  });

  it("鍵が無ければ落ちる。黙って平文で保存しない", () => {
    delete process.env.TOKEN_ENCRYPTION_KEY;
    expect(() => encryptToken("secret")).toThrow(/TOKEN_ENCRYPTION_KEY/);
  });

  it("鍵の長さが違えば落ちる", () => {
    process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(16, 1).toString("base64");
    expect(() => encryptToken("secret")).toThrow(/32/);
  });
});
