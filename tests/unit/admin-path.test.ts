import { describe, expect, it } from "vitest";
import { resolveAdminRouting } from "@/lib/security/admin-path";

const SECRET = "gestion-x7k2p9q4";

describe("resolveAdminRouting", () => {
  it.each(["/admin", "/admin/", "/admin/commandes/42"])("cache le chemin interne %s", (path) => {
    expect(resolveAdminRouting(path, SECRET)).toEqual({ kind: "not-found" });
  });

  it("cache le chemin interne même sans ADMIN_PATH configuré", () => {
    expect(resolveAdminRouting("/admin", undefined)).toEqual({ kind: "not-found" });
  });

  it("réécrit le chemin secret vers l'admin interne", () => {
    expect(resolveAdminRouting(`/${SECRET}`, SECRET)).toEqual({ kind: "rewrite", internalPath: "/admin" });
    expect(resolveAdminRouting(`/${SECRET}/commandes`, SECRET)).toEqual({
      kind: "rewrite",
      internalPath: "/admin/commandes",
    });
  });

  it("ne confond pas un préfixe partiel avec le chemin secret", () => {
    expect(resolveAdminRouting(`/${SECRET}-bis`, SECRET)).toEqual({ kind: "passthrough" });
    expect(resolveAdminRouting("/administration", SECRET)).toEqual({ kind: "passthrough" });
  });

  it("laisse passer les pages publiques", () => {
    expect(resolveAdminRouting("/", SECRET)).toEqual({ kind: "passthrough" });
    expect(resolveAdminRouting("/cgv", SECRET)).toEqual({ kind: "passthrough" });
  });
});
