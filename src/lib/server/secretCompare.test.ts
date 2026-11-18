import { describe, it, expect } from "vitest";
import { secretsMatch } from "./secretCompare";

describe("secretsMatch", () => {
  it("matches the same secret", () => {
    expect(secretsMatch("s3cret-value", "s3cret-value")).toBe(true);
  });
  it("rejects a different secret, a prefix, a missing header and an empty string", () => {
    expect(secretsMatch("s3cret-valuX", "s3cret-value")).toBe(false);
    expect(secretsMatch("s3cret", "s3cret-value")).toBe(false);
    expect(secretsMatch(null, "s3cret-value")).toBe(false);
    expect(secretsMatch("", "s3cret-value")).toBe(false);
  });
});
