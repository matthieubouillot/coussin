import { describe, expect, it } from "vitest";
import { deliveryWindow, variantAvailability } from "@/server/catalog/availability";

const offer = (o: Partial<Parameters<typeof variantAvailability>[0][number]>) => ({
  priority: 1,
  active: true,
  lastKnownStock: 10,
  deliveryDaysMin: 7,
  deliveryDaysMax: 12,
  ...o,
});

describe("variantAvailability", () => {
  it("prend le délai de la première offre disponible par priorité", () => {
    const a = variantAvailability([
      offer({ priority: 2, deliveryDaysMin: 10, deliveryDaysMax: 20 }),
      offer({ priority: 1, lastKnownStock: 0 }), // principale en rupture
    ]);
    expect(a).toEqual({ available: true, deliveryDaysMin: 10, deliveryDaysMax: 20 });
  });

  it("rupture chez tous les fournisseurs : non achetable", () => {
    expect(
      variantAvailability([offer({ lastKnownStock: 0 }), offer({ priority: 2, active: false })]),
    ).toEqual({
      available: false,
    });
    expect(variantAvailability([])).toEqual({ available: false });
  });

  it("stock inconnu (fournisseur manuel) : considéré disponible", () => {
    expect(variantAvailability([offer({ lastKnownStock: null })]).available).toBe(true);
  });
});

describe("deliveryWindow", () => {
  it("formate la fenêtre en français", () => {
    const w = deliveryWindow(
      { available: true, deliveryDaysMin: 7, deliveryDaysMax: 12 },
      new Date("2026-10-01T10:00:00Z"),
    );
    expect(w.label).toBe("entre le jeudi 8 octobre et le mardi 13 octobre");
  });
});
