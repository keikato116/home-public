import { describe, it, expect } from "vitest";
import { normalizeDisplayName, suggestDisplayName, MAX_DISPLAY_NAME } from "./displayName";
import type { User } from "@supabase/supabase-js";

function user(meta: Record<string, unknown>): User {
  return { id: "u", user_metadata: meta } as unknown as User;
}

describe("normalizeDisplayName", () => {
  it("前後の空白を落とす", () => {
    expect(normalizeDisplayName("  けい  ")).toBe("けい");
  });

  it("連続する空白を1つに潰す", () => {
    expect(normalizeDisplayName("加藤   敬一郎")).toBe("加藤 敬一郎");
  });

  it("空白だけなら未設定として null", () => {
    expect(normalizeDisplayName("")).toBeNull();
    expect(normalizeDisplayName("   ")).toBeNull();
    expect(normalizeDisplayName("　")).toBeNull();
  });

  it("長すぎる名前を切る", () => {
    const long = "あ".repeat(MAX_DISPLAY_NAME + 5);
    expect(normalizeDisplayName(long)).toHaveLength(MAX_DISPLAY_NAME);
  });

  it("絵文字を途中で割らない", () => {
    // 素朴に slice すると壊れた文字が残る
    const name = "👨‍👩‍👧".repeat(6);
    const out = normalizeDisplayName(name)!;
    expect(Array.from(out).length).toBeLessThanOrEqual(MAX_DISPLAY_NAME);
    expect(out).toBe(Array.from(name).slice(0, MAX_DISPLAY_NAME).join(""));
  });
});

describe("suggestDisplayName", () => {
  it("Google の名前を初期値にする", () => {
    expect(suggestDisplayName(user({ full_name: "加藤 敬一郎" }))).toBe("加藤 敬一郎");
  });

  it("name しか無くても拾う", () => {
    expect(suggestDisplayName(user({ name: "kei" }))).toBe("kei");
  });

  it("名前が無ければ空。メールアドレスは使わない", () => {
    // 相手に見える欄なので、勝手にアドレスを出さない（Apple は名前を渡さないことがある）
    expect(suggestDisplayName(user({ email: "kei@example.com" }))).toBe("");
    expect(suggestDisplayName(null)).toBe("");
  });
});
