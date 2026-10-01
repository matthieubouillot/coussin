import { describe, expect, it } from "vitest";
import { parseServerEnv } from "@/server/env";

const base = {
  DATABASE_URL: "postgresql://u@localhost:5432/db",
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
  ADMIN_PATH: "gestion-x7k2p9q4",
};

describe("parseServerEnv", () => {
  it("accepte une configuration minimale de développement", () => {
    expect(parseServerEnv(base).ADMIN_PATH).toBe("gestion-x7k2p9q4");
  });

  it("refuse un chemin admin évident ou trop court", () => {
    expect(() => parseServerEnv({ ...base, ADMIN_PATH: "admin" })).toThrow(/ADMIN_PATH/);
    expect(() => parseServerEnv({ ...base, ADMIN_PATH: "gestion" })).toThrow(/ADMIN_PATH/);
  });

  it("ne divulgue jamais la valeur d'une variable dans le message d'erreur", () => {
    const secretLooking = "postgres-mot-de-passe-tres-secret";
    try {
      parseServerEnv({ ...base, DATABASE_URL: secretLooking });
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("DATABASE_URL");
      expect(String(error)).not.toContain(secretLooking);
    }
  });
});
