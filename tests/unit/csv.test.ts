import { describe, expect, it } from "vitest";
import { csvAmount, csvDate, csvText, toCsv } from "@/server/accounting/csv";

describe("CSV comptable", () => {
  it("montants à la virgule, négatifs compris", () => {
    expect(csvAmount(2990)).toBe("29,90");
    expect(csvAmount(-500)).toBe("-5,00");
  });

  it("dates en heure de Paris", () => {
    // 23h30 UTC le 31 décembre = 1er janvier à Paris.
    expect(csvDate(new Date("2026-12-31T23:30:00Z"))).toBe("01/01/2027");
  });

  it("échappe les guillemets et neutralise l'injection de formule", () => {
    expect(csvText('Dupont "Jo"')).toBe('"Dupont ""Jo"""');
    expect(csvText('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
    expect(csvText("+33612")).toBe('"\'+33612"');
  });

  it("BOM UTF-8, séparateur ; et fins de ligne CRLF", () => {
    const csv = toCsv(["A", "B"], [["1", "2"]]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toBe('﻿"A";"B"\r\n1;2\r\n');
  });
});
