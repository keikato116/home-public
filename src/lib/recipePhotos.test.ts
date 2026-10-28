import { describe, it, expect } from "vitest";
import { storagePathOf } from "./recipePhotos";

describe("storagePathOf", () => {
  it("公開 URL の形からパスを取り出す", () => {
    expect(storagePathOf("https://abc.supabase.co/storage/v1/object/public/recipes/u1/x.jpg")).toBe("u1/x.jpg");
  });
  it("署名つき URL の形でも取り出す（クエリは捨てる）", () => {
    expect(storagePathOf("https://abc.supabase.co/storage/v1/object/sign/recipes/u1/x.jpg?token=t")).toBe("u1/x.jpg");
  });
  it("エンコードされた名前を戻す", () => {
    expect(storagePathOf("https://abc.supabase.co/storage/v1/object/public/recipes/u1/%E5%86%99%E7%9C%9F.jpg")).toBe("u1/写真.jpg");
  });
  it("ほかのサイトの画像はそのまま扱わない（null）", () => {
    expect(storagePathOf("https://example.com/recipes/x.jpg")).toBeNull();
    expect(storagePathOf(null)).toBeNull();
  });
});
