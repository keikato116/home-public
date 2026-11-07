import { describe, it, expect } from "vitest";
import { subscriptionRowFrom, type RcEntitlement, type RcSubscriber } from "./revenuecatSync";
import { RC_ENTITLEMENT_ID } from "@/lib/constants";

const NOW = Date.parse("2026-11-07T00:00:00Z");
const PRODUCT = "com.keikato.homeapp.premium.month";

function subscriber(ent: Record<string, unknown> | null, sandbox = false): RcSubscriber {
  return {
    entitlements: ent
      ? { [RC_ENTITLEMENT_ID]: { product_identifier: PRODUCT, expires_date: null, ...ent } as RcEntitlement }
      : {},
    subscriptions: { [PRODUCT]: { is_sandbox: sandbox } },
  };
}

describe("subscriptionRowFrom", () => {
  it("returns null when the user never had the entitlement", () => {
    expect(subscriptionRowFrom(subscriber(null), NOW)).toBeNull();
  });

  it("ignores other entitlements", () => {
    const s = { entitlements: { other: { expires_date: null } } };
    expect(subscriptionRowFrom(s, NOW)).toBeNull();
  });

  it("is active before the expiry", () => {
    const row = subscriptionRowFrom(subscriber({ expires_date: "2026-12-07T00:00:00Z" }, true), NOW);
    expect(row).toEqual({
      product_id: PRODUCT,
      status: "active",
      expires_at: "2026-12-07T00:00:00Z",
      environment: "SANDBOX",
    });
  });

  it("is active with no expiry", () => {
    expect(subscriptionRowFrom(subscriber({ expires_date: null }), NOW)?.status).toBe("active");
  });

  it("uses the grace period end while billing is retried", () => {
    const row = subscriptionRowFrom(
      subscriber({ expires_date: "2026-11-06T00:00:00Z", grace_period_expires_date: "2026-11-20T00:00:00Z" }),
      NOW
    );
    expect(row?.status).toBe("in_grace");
    expect(row?.expires_at).toBe("2026-11-20T00:00:00Z");
    expect(row?.environment).toBe("PRODUCTION");
  });

  it("is expired after the expiry and any grace period", () => {
    const row = subscriptionRowFrom(
      subscriber({ expires_date: "2026-11-01T00:00:00Z", grace_period_expires_date: "2026-11-05T00:00:00Z" }),
      NOW
    );
    expect(row?.status).toBe("expired");
    expect(row?.expires_at).toBe("2026-11-01T00:00:00Z");
  });
});
