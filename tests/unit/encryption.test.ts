import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "@/server/security/encryption";

describe("chiffrement des jetons fournisseur", () => {
  const key = randomBytes(32);

  it("aller-retour, avec un IV différent à chaque chiffrement", () => {
    const a = encryptSecret("jeton-secret", key);
    expect(decryptSecret(a, key)).toBe("jeton-secret");
    expect(encryptSecret("jeton-secret", key)).not.toBe(a);
  });

  it("refuse un contenu altéré ou une mauvaise clé", () => {
    const payload = encryptSecret("jeton-secret", key);
    const parts = payload.split(".");
    parts[3] = Buffer.from("autre").toString("base64url");
    expect(() => decryptSecret(parts.join("."), key)).toThrow();
    expect(() => decryptSecret(payload, randomBytes(32))).toThrow();
  });
});
