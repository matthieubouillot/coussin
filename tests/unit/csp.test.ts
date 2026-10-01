import { describe, expect, it } from "vitest";
import { buildCsp, generateNonce } from "@/lib/security/csp";

function directive(csp: string, name: string): string | undefined {
  return csp.split("; ").find((d) => d === name || d.startsWith(`${name} `));
}

describe("buildCsp", () => {
  const prod = buildCsp({ nonce: "abc123", isDev: false });

  it("n'autorise que les scripts portant le nonce", () => {
    expect(directive(prod, "script-src")).toBe("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
  });

  it("n'autorise jamais de script ou de balise <style> en ligne sans nonce en production", () => {
    expect(directive(prod, "script-src")).not.toContain("unsafe-inline");
    expect(directive(prod, "style-src")).toBe("style-src 'self' 'nonce-abc123'");
    expect(prod).not.toContain("unsafe-eval");
  });

  it("autorise seulement les attributs style en ligne", () => {
    expect(directive(prod, "style-src-attr")).toBe("style-src-attr 'unsafe-inline'");
  });

  it("interdit l'affichage dans une iframe et les plugins", () => {
    expect(directive(prod, "frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(directive(prod, "object-src")).toBe("object-src 'none'");
  });

  it("force HTTPS en production uniquement", () => {
    expect(directive(prod, "upgrade-insecure-requests")).toBeDefined();
    const dev = buildCsp({ nonce: "abc123", isDev: true });
    expect(directive(dev, "upgrade-insecure-requests")).toBeUndefined();
    expect(directive(dev, "script-src")).toContain("'unsafe-eval'");
  });
});

describe("generateNonce", () => {
  it("produit une valeur différente à chaque appel", () => {
    const nonces = new Set(Array.from({ length: 100 }, generateNonce));
    expect(nonces.size).toBe(100);
  });
});
