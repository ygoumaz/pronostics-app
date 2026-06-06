import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { aggregatePronosticStats, formatScore } from "./stats";
import type { PronosticGoals } from "./stats";

// Feature: pronostics-coupe-du-monde, Property 18: Statistics aggregation correctness

/**
 * Property 18: Statistics aggregation correctness
 * Validates: Requirements 16.1, 16.2
 *
 * Pour tout ensemble de pronostics d'un match clôturé, le résumé statistique DOIT :
 *  - compter correctement chaque score distinct (« homeGoals-awayGoals ») ;
 *  - la somme de tous les `count` DOIT être égale au nombre total de pronostics ;
 *  - être trié par `count` décroissant, puis, en cas d'égalité, par `score` en
 *    ordre lexicographique croissant.
 */

// Buts restreints à [0,5] pour forcer des collisions de scores (plus de doublons).
const goalArb = fc.integer({ min: 0, max: 5 });

const pronosticArb: fc.Arbitrary<PronosticGoals> = fc.record({
  homeGoals: goalArb,
  awayGoals: goalArb,
});

const pronosticsArb = fc.array(pronosticArb, { maxLength: 80 });

describe("Property 18: Statistics aggregation correctness", () => {
  // Validates: Requirements 16.1, 16.2
  it("agrège, compte et trie correctement les scores pronostiqués pour tout ensemble de pronostics", () => {
    fc.assert(
      fc.property(pronosticsArb, (pronostics) => {
        const summary = aggregatePronosticStats(pronostics);

        // (1) total === longueur de l'entrée.
        expect(summary.total).toBe(pronostics.length);

        // (2) Somme des count === total.
        const sumCounts = summary.scores.reduce((acc, s) => acc + s.count, 0);
        expect(sumCounts).toBe(summary.total);

        // (3) Chaque count distinct === occurrences comptées indépendamment.
        const expectedCounts = new Map<string, number>();
        for (const p of pronostics) {
          const score = formatScore(p.homeGoals, p.awayGoals);
          expectedCounts.set(score, (expectedCounts.get(score) ?? 0) + 1);
        }
        for (const { score, count } of summary.scores) {
          expect(count).toBe(expectedCounts.get(score));
        }
        // Tous les scores distincts de l'entrée sont présents dans la sortie.
        expect(summary.scores.length).toBe(expectedCounts.size);

        // (5) Aucune entrée de score dupliquée dans la sortie.
        const outputScores = summary.scores.map((s) => s.score);
        expect(new Set(outputScores).size).toBe(outputScores.length);

        // (4) Tri par count décroissant, puis score lexicographique croissant.
        for (let i = 1; i < summary.scores.length; i++) {
          const prev = summary.scores[i - 1];
          const cur = summary.scores[i];
          if (prev.count === cur.count) {
            expect(prev.score < cur.score).toBe(true);
          } else {
            expect(prev.count).toBeGreaterThan(cur.count);
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});
