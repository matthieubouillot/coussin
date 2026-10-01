import { describe, expect, it } from "vitest";
import { describeBundle } from "@/server/catalog/describe-bundle";

const labels = new Map([
  ["m", "M"],
  ["l", "L"],
]);

describe("describeBundle", () => {
  it("décrit les offres validées en phase 0", () => {
    expect(
      describeBundle(
        {
          kind: "QUANTITY",
          minQuantity: 2,
          comboVariantIds: [],
          discountType: "PERCENT",
          discountValue: 1000,
        },
        labels,
      ),
    ).toBe("Dès 2 coussins dans le panier : −10 % sur les articles");
    expect(
      describeBundle(
        {
          kind: "COMBO",
          minQuantity: null,
          comboVariantIds: ["m", "l"],
          discountType: "FIXED",
          discountValue: 500,
        },
        labels,
      ),
    ).toBe("M + L achetés ensemble : −5,00 €");
  });

  it("n'affiche rien si une variante du combo n'existe plus", () => {
    expect(
      describeBundle(
        {
          kind: "COMBO",
          minQuantity: null,
          comboVariantIds: ["m", "x"],
          discountType: "FIXED",
          discountValue: 500,
        },
        labels,
      ),
    ).toBeNull();
  });
});
