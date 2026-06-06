import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { computeRegistrationOpen } from "./registration";

// Feature: pronostics-coupe-du-monde, Property 10: Registration closure

/**
 * Représente l'état « possède un résultat officiel » des matchs de la Journée 1
 * sous forme d'un tableau de booléens. On couvre des longueurs variables,
 * y compris vide (données non seedées) et la taille réelle de GROUP_DAY_1 (24).
 */
const day1FlagsArb = (): fc.Arbitrary<boolean[]> =>
  fc.array(fc.boolean(), { minLength: 0, maxLength: 30 });

const toMatches = (flags: ReadonlyArray<boolean>) =>
  flags.map((hasResult) => ({ hasResult }));

describe("Property 10: Registration closure", () => {
  // Validates: Requirements 1.10

  it("open === (aucun match || au moins un match sans résultat) [iff]", () => {
    fc.assert(
      fc.property(day1FlagsArb(), (flags) => {
        const open = computeRegistrationOpen(toMatches(flags));
        // Exigence 1.10 : closes ssi tous les matchs Journée 1 ont un résultat.
        const expectedOpen =
          flags.length === 0 || flags.some((hasResult) => !hasResult);
        expect(open).toBe(expectedOpen);
      }),
      { numRuns: 100 }
    );
  });

  it("tableau vide → inscriptions ouvertes", () => {
    expect(computeRegistrationOpen([])).toBe(true);
  });

  it("non vide, tous les matchs ont un résultat → closes (false)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 30 }),
        (n) => {
          const flags = Array.from({ length: n }, () => true);
          expect(computeRegistrationOpen(toMatches(flags))).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("non vide, au moins un match sans résultat → ouvertes (true)", () => {
    fc.assert(
      fc.property(
        // Tableau non vide avec au moins un false garanti.
        fc
          .array(fc.boolean(), { minLength: 0, maxLength: 29 })
          .chain((rest) =>
            fc.nat({ max: rest.length }).map((insertAt) => {
              const flags = [...rest];
              flags.splice(insertAt, 0, false); // insère au moins un false
              return flags;
            })
          ),
        (flags) => {
          expect(computeRegistrationOpen(toMatches(flags))).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
