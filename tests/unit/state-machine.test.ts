import { describe, expect, it } from "vitest";
import { canTransition, ORDER_TRANSITIONS } from "@/server/orders/state-machine";

describe("machine à états des commandes", () => {
  it("suit le parcours nominal", () => {
    const path = ["PENDING_PAYMENT", "PAID", "SENT_TO_SUPPLIER", "SHIPPED", "DELIVERED"] as const;
    for (let i = 0; i < path.length - 1; i++) expect(canTransition(path[i]!, path[i + 1]!)).toBe(true);
  });

  it("interdit les sauts illégaux", () => {
    expect(canTransition("PENDING_PAYMENT", "SHIPPED")).toBe(false);
    expect(canTransition("PAID", "DELIVERED")).toBe(false);
    expect(canTransition("DELIVERED", "PAID")).toBe(false);
    expect(canTransition("CANCELLED", "PAID")).toBe(false);
  });

  it("une commande remboursée est un état final", () => {
    expect(ORDER_TRANSITIONS.REFUNDED).toEqual([]);
  });

  it("une erreur de fulfillment peut être reprise", () => {
    expect(canTransition("FULFILLMENT_ERROR", "SENT_TO_SUPPLIER")).toBe(true);
  });
});
