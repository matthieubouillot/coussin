import { describe, expect, it } from "vitest";
import { safeErrorMessage } from "@/lib/logging/safe-error";

describe("messages d'erreur sans donnée personnelle", () => {
  it("ne garde que la cause d'une erreur Prisma, sans les arguments de la requête", () => {
    const prismaLike = Object.assign(
      new Error(
        '\nInvalid `prisma.order.update()` invocation in\n/app/x.ts:12:3\n\n  data: { email: "camille@example.fr", shippingLine1: "12 rue des Lilas" }\n\nUnique constraint failed on the fields: (`stripePaymentIntentId`)',
      ),
      { name: "PrismaClientKnownRequestError", code: "P2002" },
    );
    const message = safeErrorMessage(prismaLike);
    expect(message).toBe(
      "[P2002] PrismaClientKnownRequestError: Unique constraint failed on the fields: (`stripePaymentIntentId`)",
    );
    expect(message).not.toContain("rue des Lilas");
  });

  it("masque emails et téléphones dans un message ordinaire", () => {
    expect(safeErrorMessage(new Error("échec pour camille@example.fr au 06 12 34 56 78"))).toBe(
      "Error: échec pour [email] au [téléphone]",
    );
  });
});
