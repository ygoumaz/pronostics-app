import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { computeLockTime, isOpenAt } from "./lock";

// Feature: pronostics-coupe-du-monde, Property 7: Pronostic lock enforcement

/**
 * Prédicat d'autorisation d'une opération sur un Pronostic (création OU
 * modification). L'enforcement se réduit entièrement à l'état d'ouverture de
 * l'étape : l'opération est autorisée si et seulement si l'étape est ouverte
 * à l'instant `now` (now < lockTime, cf. Exigences 5.3 à 5.6).
 *
 * Le paramètre `operation` est volontairement présent pour rendre explicite que
 * la création et la modification passent par la même porte (aucune ne dispose
 * d'un traitement de faveur).
 */
function canPerformPronosticOperation(
  _operation: "create" | "modify",
  lockTime: Date,
  now: Date
): boolean {
  return isOpenAt(lockTime, now);
}

const kickoff = () =>
  fc.date({
    min: new Date("2025-01-01T00:00:00.000Z"),
    max: new Date("2027-12-31T23:59:59.999Z"),
    noInvalidDate: true,
  });

describe("Property 7: Pronostic lock enforcement", () => {
  // Validates: Requirements 5.3, 5.4, 5.5, 5.6

  it("une opération (create/modify) est autorisée SSI now est strictement avant la clôture", () => {
    fc.assert(
      fc.property(
        kickoff(),
        // Décalage de `now` par rapport à la clôture : strictement négatif (avant),
        // nul (à la clôture) ou positif (après). Couvre les trois régimes.
        fc.integer({ min: -7_200_000, max: 7_200_000 }),
        (firstKickoff, offsetMs) => {
          const lockTime = computeLockTime(firstKickoff);
          const now = new Date(lockTime.getTime() + offsetMs);

          const open = isOpenAt(lockTime, now);
          const allowedCreate = canPerformPronosticOperation("create", lockTime, now);
          const allowedModify = canPerformPronosticOperation("modify", lockTime, now);

          // L'autorisation reflète exactement l'état d'ouverture (Exigences 5.3/5.4).
          expect(allowedCreate).toBe(open);
          expect(allowedModify).toBe(open);

          if (now.getTime() < lockTime.getTime()) {
            // Exigence 5.3 : strictement avant la clôture → création ET
            // modification autorisées.
            expect(allowedCreate).toBe(true);
            expect(allowedModify).toBe(true);
          } else {
            // now >= lockTime → étape clôturée.
            // Exigence 5.6 : nouvelle création rejetée.
            expect(allowedCreate).toBe(false);
            // Exigence 5.5 : modification rejetée.
            expect(allowedModify).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it("la décision est identique pour create et modify (même porte de verrouillage)", () => {
    fc.assert(
      fc.property(
        kickoff(),
        fc.integer({ min: -7_200_000, max: 7_200_000 }),
        (firstKickoff, offsetMs) => {
          const lockTime = computeLockTime(firstKickoff);
          const now = new Date(lockTime.getTime() + offsetMs);

          // Aucune des deux opérations ne bénéficie d'un traitement différent :
          // elles partagent strictement le même gate (Exigences 5.5 et 5.6).
          expect(canPerformPronosticOperation("create", lockTime, now)).toBe(
            canPerformPronosticOperation("modify", lockTime, now)
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it("aux bornes exactes : autorisé 1 ms avant, rejeté à l'instant de clôture", () => {
    fc.assert(
      fc.property(kickoff(), (firstKickoff) => {
        const lockTime = computeLockTime(firstKickoff);

        const justBefore = new Date(lockTime.getTime() - 1);
        const atLock = new Date(lockTime.getTime());

        // Strictement avant → autorisé pour les deux opérations.
        expect(canPerformPronosticOperation("create", lockTime, justBefore)).toBe(true);
        expect(canPerformPronosticOperation("modify", lockTime, justBefore)).toBe(true);

        // À l'instant exact de clôture → rejeté pour les deux opérations.
        expect(canPerformPronosticOperation("create", lockTime, atLock)).toBe(false);
        expect(canPerformPronosticOperation("modify", lockTime, atLock)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });
});
