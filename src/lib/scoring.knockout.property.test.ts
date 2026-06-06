import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { calculatePoints } from "./scoring";

// Feature: pronostics-coupe-du-monde, Property 3: Knockout draw outcome for penalty shootouts
//
// Property statement (design.md):
// Pour tout résultat de match éliminatoire où homeGoals == awayGoals (match
// terminé aux tirs au but), et pour tout pronostic prédisant un nul (n'importe
// quel score égal), calculatePoints DOIT retourner correctOutcome = true.
//
// Note : le vainqueur aux tirs au but ne fait pas partie de calculatePoints —
// le résultat enregistré pour un match aux TAB est le nul après prolongations.
// Cela se réduit donc à : tout pronostic nul face à tout résultat nul donne
// correctOutcome = true.
//
// Validates: Requirements 8.10
describe("calculatePoints - Property 3: issue d'un match éliminatoire aux TAB", () => {
  it("retourne correctOutcome=true pour tout pronostic nul face à tout résultat nul", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 99 }),
        fc.integer({ min: 0, max: 99 }),
        (resultGoals, pronoGoals) => {
          const result = { homeGoals: resultGoals, awayGoals: resultGoals };
          const pronostic = { homeGoals: pronoGoals, awayGoals: pronoGoals };

          const { correctOutcome, correctDifference } = calculatePoints(
            pronostic,
            result
          );

          // Deux nuls -> même issue (DRAW == DRAW)
          expect(correctOutcome).toBe(true);
          // Deux nuls -> différence de buts nulle de part et d'autre
          expect(correctDifference).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
