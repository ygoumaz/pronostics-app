import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { canViewOthersPronostic } from "./pronostic-visibility";

// Feature: pronostics-coupe-du-monde, Property 8: Pronostic confidentiality

/**
 * Générateur de dates dans une plage raisonnable (autour de la Coupe du Monde
 * 2026), pour éviter les valeurs extrêmes/invalides.
 */
const dateGen = () =>
  fc.date({
    min: new Date("2025-01-01T00:00:00.000Z"),
    max: new Date("2027-12-31T23:59:59.999Z"),
    noInvalidDate: true,
  });

/**
 * Modèle de la règle de visibilité complète (Exigence 6.1, 6.2, 6.3) :
 * un participant voit toujours ses propres pronostics ; le pronostic d'autrui
 * n'est visible qu'au coup d'envoi atteint.
 */
function canView(isOwn: boolean, kickoff: Date, now: Date): boolean {
  return isOwn || canViewOthersPronostic(kickoff, now);
}

describe("Property 8: Pronostic confidentiality", () => {
  // Validates: Requirements 6.1, 6.2, 6.3

  it("canViewOthersPronostic est vrai si et seulement si now >= kickoff", () => {
    fc.assert(
      fc.property(dateGen(), dateGen(), (kickoff, now) => {
        // Exigence 6.1 / 6.2 : visibilité d'autrui strictement liée au coup d'envoi.
        const expected = now.getTime() >= kickoff.getTime();
        expect(canViewOthersPronostic(kickoff, now)).toBe(expected);
      }),
      { numRuns: 100 }
    );
  });

  it("respecte les frontières exactes autour du coup d'envoi", () => {
    fc.assert(
      fc.property(dateGen(), (kickoff) => {
        const before = new Date(kickoff.getTime() - 1);
        const at = new Date(kickoff.getTime());
        const after = new Date(kickoff.getTime() + 1);

        // Exigence 6.1 : masqué tant que le coup d'envoi n'est pas atteint.
        expect(canViewOthersPronostic(kickoff, before)).toBe(false);
        // Exigence 6.2 : visible dès l'instant exact du coup d'envoi.
        expect(canViewOthersPronostic(kickoff, at)).toBe(true);
        // Exigence 6.2 : visible après le coup d'envoi.
        expect(canViewOthersPronostic(kickoff, after)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it("un participant voit toujours ses propres pronostics, quel que soit l'instant", () => {
    fc.assert(
      fc.property(dateGen(), dateGen(), (kickoff, now) => {
        // Exigence 6.3 : ses propres pronostics sont toujours visibles.
        expect(canView(true, kickoff, now)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it("pour les pronostics d'autrui, la visibilité suit canViewOthersPronostic", () => {
    fc.assert(
      fc.property(dateGen(), dateGen(), (kickoff, now) => {
        // Exigence 6.1 / 6.2 : pour autrui (isOwn=false), la règle se réduit à
        // la visibilité liée au coup d'envoi.
        expect(canView(false, kickoff, now)).toBe(
          canViewOthersPronostic(kickoff, now)
        );
      }),
      { numRuns: 100 }
    );
  });
});
