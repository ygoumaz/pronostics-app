import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { calculatePoints } from "./scoring";

// Feature: pronostics-coupe-du-monde, Property 2: Exact score implies all sub-criteria
describe("calculatePoints - Property 2: Exact score implies all sub-criteria", () => {
  it("returns all sub-criteria true and totalPoints=3 when pronostic matches result exactly", () => {
    // Validates: Requirements 8.4
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 99 }),
        fc.integer({ min: 0, max: 99 }),
        (homeGoals, awayGoals) => {
          const score = { homeGoals, awayGoals };
          // Pass the same score as both pronostic and result to guarantee an exact match.
          const res = calculatePoints(score, score);

          expect(res.correctOutcome).toBe(true);
          expect(res.correctDifference).toBe(true);
          expect(res.exactScore).toBe(true);
          expect(res.totalPoints).toBe(3);
        }
      ),
      { numRuns: 100 }
    );
  });
});
