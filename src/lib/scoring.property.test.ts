import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { calculatePoints } from "./scoring";

// Feature: pronostics-coupe-du-monde, Property 1: Scoring correctness

/**
 * Re-dérivation indépendante de l'issue d'un score, sans appeler
 * l'implémentation sous test, afin de valider réellement le calcul.
 */
function expectedOutcome(homeGoals: number, awayGoals: number): string {
  if (homeGoals > awayGoals) return "HOME_WIN";
  if (homeGoals < awayGoals) return "AWAY_WIN";
  return "DRAW";
}

const goal = () => fc.integer({ min: 0, max: 99 });

describe("Property 1: Scoring correctness (barème complet)", () => {
  // Validates: Requirements 8.2, 8.3, 8.4, 8.5, 8.7, 8.8
  it("calcule correctOutcome, correctDifference, exactScore et totalPoints pour toute paire de scores", () => {
    fc.assert(
      fc.property(
        goal(),
        goal(),
        goal(),
        goal(),
        (pHome, pAway, rHome, rAway) => {
          const pronostic = { homeGoals: pHome, awayGoals: pAway };
          const result = { homeGoals: rHome, awayGoals: rAway };

          const scoring = calculatePoints(pronostic, result);

          // Attendus re-dérivés indépendamment.
          const expectedCorrectOutcome =
            expectedOutcome(pHome, pAway) === expectedOutcome(rHome, rAway);
          const expectedCorrectDifference =
            pHome - pAway === rHome - rAway;
          const expectedExactScore = pHome === rHome && pAway === rAway;
          const expectedTotal =
            (expectedCorrectOutcome ? 1 : 0) +
            (expectedCorrectDifference ? 1 : 0) +
            (expectedExactScore ? 1 : 0);

          // Exigence 8.8 : bonne issue.
          expect(scoring.correctOutcome).toBe(expectedCorrectOutcome);
          // Exigence 8.3 : bonne différence de buts.
          expect(scoring.correctDifference).toBe(expectedCorrectDifference);
          // Exigence 8.4 : score exact.
          expect(scoring.exactScore).toBe(expectedExactScore);
          // Exigence 8.2/8.7 : total = nombre de booléens vrais.
          expect(scoring.totalPoints).toBe(expectedTotal);
          // Exigence 8.5 : total toujours dans [0, 3].
          expect(scoring.totalPoints).toBeGreaterThanOrEqual(0);
          expect(scoring.totalPoints).toBeLessThanOrEqual(3);
          expect(scoring.totalPoints).toBe(
            [
              scoring.correctOutcome,
              scoring.correctDifference,
              scoring.exactScore,
            ].filter(Boolean).length
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});
