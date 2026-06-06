import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { compareMatches, homeSortKey, type SortableMatch } from "./match-sort";

// Feature: pronostics-coupe-du-monde, Property 5: Match sorting invariant

/**
 * Property 5: Match sorting invariant
 * Validates: Requirements 3.7
 *
 * Pour toute liste de matchs, la sortie triée DOIT avoir des `kickoffTime`
 * croissants (non décroissants) et, pour deux matchs partageant le même
 * `kickoffTime`, la clé de l'équipe à domicile (`homeSortKey`) du premier DOIT
 * être lexicographiquement <= à celle du second.
 */

// Petit ensemble de dates distinctes pour forcer des égalités de coup d'envoi.
const kickoffArb = fc.constantFrom(
  new Date("2026-06-11T16:00:00.000Z"),
  new Date("2026-06-11T19:00:00.000Z"),
  new Date("2026-06-12T16:00:00.000Z"),
  new Date("2026-06-12T19:00:00.000Z")
);

// Codes/emplacements parfois null pour exercer la valeur de repli "".
const homeStringArb = fc.option(
  fc.constantFrom("ARG", "BRA", "FRA", "GER", "JPN", "W37", "RU-A"),
  { nil: null, freq: 4 }
);

const sortableMatchArb: fc.Arbitrary<SortableMatch> = fc.record({
  kickoffTime: kickoffArb,
  homeTeamCode: homeStringArb,
  homePlaceholder: homeStringArb,
});

describe("Property 5: Match sorting invariant", () => {
  // Validates: Requirements 3.7
  it("trie par coup d'envoi croissant puis par clé d'équipe à domicile croissante", () => {
    fc.assert(
      fc.property(fc.array(sortableMatchArb, { maxLength: 30 }), (matches) => {
        const sorted = [...matches].sort(compareMatches);

        for (let i = 1; i < sorted.length; i++) {
          const prev = sorted[i - 1];
          const next = sorted[i];

          // (1) kickoffTime non décroissant.
          expect(prev.kickoffTime.getTime()).toBeLessThanOrEqual(
            next.kickoffTime.getTime()
          );

          // (2) À coup d'envoi égal, clé d'équipe à domicile croissante.
          if (prev.kickoffTime.getTime() === next.kickoffTime.getTime()) {
            expect(homeSortKey(prev) <= homeSortKey(next)).toBe(true);
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});
