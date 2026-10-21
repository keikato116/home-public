import { describe, it, expect } from "vitest";
import { isPrivateAddress } from "./safeFetch";

describe("isPrivateAddress", () => {
  it.each([
    "127.0.0.1", "10.0.0.5", "172.16.0.1", "172.31.255.255", "192.168.1.1",
    "169.254.169.254", "0.0.0.0", "100.64.0.1", "224.0.0.1",
    "::1", "::", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:169.254.169.254",
  ])("%s は通さない", (ip) => {
    expect(isPrivateAddress(ip)).toBe(true);
  });

  it.each(["8.8.8.8", "172.32.0.1", "203.0.113.10", "2606:4700:4700::1111", "::ffff:8.8.8.8"])(
    "%s は通す",
    (ip) => {
      expect(isPrivateAddress(ip)).toBe(false);
    }
  );

  it("IP として読めないものは通さない", () => {
    expect(isPrivateAddress("localhost")).toBe(true);
  });
});
