import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { getMatchStatus } from "./match-status";

// Feature: pronostics-coupe-du-monde, Property 20: Match status determination

/**
 * Générateur de dates dans une plage raisonnable (autour de la Coupe du Monde
 * 2026), pour éviter les valeurs extrêmes/invalides.
 */
const date = () =>
  fc.date({
    min: new Date("2025-01-01T00:00:00.000Z"),
    max: new Date("2027-12-31T23:59:59.999Z"),
    noInvalidDate: true,
  });

describe("Property 20: Match status determination", () => {
  // Validates: Requirements 3.9

  it("dérive le statut du match indépendamment selon le résultat et l'instant", () => {
    fc.assert(
      fc.property(date(), date(), fc.boolean(), (kickoffTime, now, hasResult) => {
        const status = getMatchStatus(kickoffTime, hasResult, now);

        // Ré-dérivation indépendante des règles 3.9 :
        //   - un résultat officiel rend le match « terminé » (prioritaire) ;
        //   - sinon « à venir » strictement avant le coup d'envoi ;
        //   - sinon « en cours » (coup d'envoi atteint).
        if (hasResult) {
          expect(status).toBe("terminé");
        } else if (now.getTime() < kickoffTime.getTime()) {
          expect(status).toBe("à venir");
        } else {
          expect(status).toBe("en cours");
        }
      }),
      { numRuns: 100 }
    );
  });

  it("au coup d'envoi exact (now === kickoffTime) sans résultat, le match est « en cours »", () => {
    fc.assert(
      fc.property(date(), (kickoffTime) => {
        // Instant strictement égal au coup d'envoi (now >= kickoffTime).
        const now = new Date(kickoffTime.getTime());
        expect(getMatchStatus(kickoffTime, false, now)).toBe("en cours");
      }),
      { numRuns: 100 }
    );
  });
});
