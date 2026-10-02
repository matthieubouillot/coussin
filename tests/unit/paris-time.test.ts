import { describe, expect, it } from "vitest";
import { accountingPeriod, dateToParisLocalInput, parisLocalToDate, parisMidnight } from "@/lib/paris-time";

describe("heure de Paris", () => {
  it("minuit à Paris en hiver (UTC+1) et en été (UTC+2)", () => {
    expect(parisMidnight(2026, 1, 15).toISOString()).toBe("2026-01-14T23:00:00.000Z");
    expect(parisMidnight(2026, 7, 15).toISOString()).toBe("2026-07-14T22:00:00.000Z");
  });

  it("gère les débordements de mois et d'année", () => {
    expect(parisMidnight(2026, 13, 1).toISOString()).toBe("2026-12-31T23:00:00.000Z");
  });

  it("trimestre comptable", () => {
    const q4 = accountingPeriod(2026, "quarter", 4);
    expect(q4.start.toISOString()).toBe("2026-09-30T22:00:00.000Z");
    expect(q4.end.toISOString()).toBe("2026-12-31T23:00:00.000Z");
  });

  it("aller-retour d'une saisie datetime-local", () => {
    const d = parisLocalToDate("2026-12-01T09:30")!;
    expect(d.toISOString()).toBe("2026-12-01T08:30:00.000Z");
    expect(dateToParisLocalInput(d)).toBe("2026-12-01T09:30");
    expect(parisLocalToDate("n'importe quoi")).toBeNull();
  });
});
