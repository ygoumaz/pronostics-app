import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { computeLockTime, isOpenAt, getTimeRemainingAt } from "./lock";

// Feature: pronostics-coupe-du-monde, Property 6: Stage lock time calculation

const ONE_HOUR_MS = 3_600_000;

/**
 * Générateur de dates dans une plage raisonnable (autour de la Coupe du Monde
 * 2026), pour éviter les valeurs extrêmes/invalides.
 */
const kickoff = () =>
  fc.date({
    min: new Date("2025-01-01T00:00:00.000Z"),
    max: new Date("2027-12-31T23:59:59.999Z"),
    noInvalidDate: true,
  });

describe("Property 6: Stage lock time calculation", () => {
  // Validates: Requirements 5.1, 5.2

  it("computeLockTime(kickoff) vaut exactement kickoff - 1 heure", () => {
    fc.assert(
      fc.property(kickoff(), (firstKickoff) => {
        const lockTime = computeLockTime(firstKickoff);
        // Exigence 5.2 : clôture = coup d'envoi - 1 heure (exactement 3 600 000 ms).
        expect(firstKickoff.getTime() - lockTime.getTime()).toBe(ONE_HOUR_MS);
      }),
      { numRuns: 100 }
    );
  });

  it("le coup d'envoi le plus tôt détermine l'heure de clôture de l'étape", () => {
    fc.assert(
      fc.property(
        fc.array(kickoff(), { minLength: 1, maxLength: 16 }),
        (kickoffs) => {
          // L'étape contient au moins un match (minLength: 1).
          const earliest = kickoffs.reduce((min, d) =>
            d.getTime() < min.getTime() ? d : min
          );

          const stageLockTime = computeLockTime(earliest);

          // Exigence 5.2 : l'heure de clôture dérive du match le plus tôt.
          expect(stageLockTime.getTime()).toBe(earliest.getTime() - ONE_HOUR_MS);

          // Exigence 5.1 : tous les matchs partagent le même statut de clôture,
          // car la clôture issue du plus tôt est antérieure ou égale à celle de
          // n'importe quel autre match de l'étape.
          for (const k of kickoffs) {
            expect(stageLockTime.getTime()).toBeLessThanOrEqual(
              computeLockTime(k).getTime()
            );
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it("isOpenAt est vrai strictement avant la clôture et faux à/après la clôture", () => {
    fc.assert(
      fc.property(kickoff(), (firstKickoff) => {
        const lockTime = computeLockTime(firstKickoff);

        const justBefore = new Date(lockTime.getTime() - 1);
        const atLock = new Date(lockTime.getTime());
        const justAfter = new Date(lockTime.getTime() + 1);

        // Exigence 5.3 : ouvert strictement avant la clôture.
        expect(isOpenAt(lockTime, justBefore)).toBe(true);
        // Exigence 5.4 : fermé dès l'heure de clôture atteinte.
        expect(isOpenAt(lockTime, atLock)).toBe(false);
        // Exigence 5.4 : fermé après la clôture.
        expect(isOpenAt(lockTime, justAfter)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it("getTimeRemainingAt renvoie le temps restant borné à 0", () => {
    fc.assert(
      fc.property(kickoff(), (firstKickoff) => {
        const lockTime = computeLockTime(firstKickoff);

        const justBefore = new Date(lockTime.getTime() - 1);
        const atLock = new Date(lockTime.getTime());
        const justAfter = new Date(lockTime.getTime() + 1);

        // Strictement avant : il reste exactement 1 ms.
        expect(getTimeRemainingAt(lockTime, justBefore)).toBe(1);
        // À l'heure de clôture : 0 (borné).
        expect(getTimeRemainingAt(lockTime, atLock)).toBe(0);
        // Après la clôture : borné à 0, jamais négatif.
        expect(getTimeRemainingAt(lockTime, justAfter)).toBe(0);
      }),
      { numRuns: 100 }
    );
  });
});
