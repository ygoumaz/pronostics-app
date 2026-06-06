import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { isValidGoalCount, validateGoals, GOAL_LIMITS } from "./validation";

// Feature: pronostics-coupe-du-monde, Property 12: Input validation — goal scores
//
// Property 12 : Validation des scores de buts.
// Validates: Requirements 4.1, 4.4, 7.1, 7.6
//
// Pour toute valeur soumise comme nombre de buts qui n'est pas un entier, qui
// est négative ou supérieure à 99, la soumission d'un pronostic ET la saisie
// d'un résultat officiel DOIVENT être rejetées. Pour tout entier de [0, 99],
// la soumission DOIT être acceptée (sous réserve des autres préconditions).

const NUM_RUNS = 100;

// --- Générateurs ------------------------------------------------------------

// Buts valides : entier dans [0, 99].
const validGoal = fc.integer({
  min: GOAL_LIMITS.GOAL_MIN,
  max: GOAL_LIMITS.GOAL_MAX,
});

// Entiers négatifs : < 0.
const negativeGoal = fc.integer({ max: GOAL_LIMITS.GOAL_MIN - 1 });

// Entiers > 99.
const tooBigGoal = fc.integer({ min: GOAL_LIMITS.GOAL_MAX + 1 });

// Nombres non entiers finis (ex : 3.5).
const nonIntegerGoal = fc
  .double({ noNaN: true, noDefaultInfinity: true })
  .filter((n) => Number.isFinite(n) && !Number.isInteger(n));

// Valeurs non numériques (mauvais type) et valeurs numériques spéciales.
const nonNumberValue = fc.oneof(
  fc.string(),
  fc.constant(null),
  fc.constant(undefined),
  fc.constant(NaN),
  fc.boolean(),
  fc.constant(Infinity),
  fc.constant(-Infinity)
);

// Toute valeur invalide : agrégat de tous les cas de rejet.
const invalidGoal = fc.oneof(
  negativeGoal,
  tooBigGoal,
  nonIntegerGoal,
  nonNumberValue
);

// --- isValidGoalCount -------------------------------------------------------

describe("Property 12: isValidGoalCount", () => {
  it("accepte tout entier de [0, 99]", () => {
    fc.assert(
      fc.property(validGoal, (goal) => {
        expect(isValidGoalCount(goal)).toBe(true);
      }),
      { numRuns: NUM_RUNS }
    );
  });

  it("rejette tout entier négatif", () => {
    fc.assert(
      fc.property(negativeGoal, (goal) => {
        expect(isValidGoalCount(goal)).toBe(false);
      }),
      { numRuns: NUM_RUNS }
    );
  });

  it("rejette tout entier supérieur à 99", () => {
    fc.assert(
      fc.property(tooBigGoal, (goal) => {
        expect(isValidGoalCount(goal)).toBe(false);
      }),
      { numRuns: NUM_RUNS }
    );
  });

  it("rejette tout nombre non entier", () => {
    fc.assert(
      fc.property(nonIntegerGoal, (goal) => {
        expect(isValidGoalCount(goal)).toBe(false);
      }),
      { numRuns: NUM_RUNS }
    );
  });

  it("rejette toute valeur non numérique ou spéciale (NaN, Infinity)", () => {
    fc.assert(
      fc.property(nonNumberValue, (value) => {
        expect(isValidGoalCount(value)).toBe(false);
      }),
      { numRuns: NUM_RUNS }
    );
  });
});

// --- validateGoals ----------------------------------------------------------

describe("Property 12: validateGoals", () => {
  it("accepte deux buts valides (pronostic et résultat officiel)", () => {
    fc.assert(
      fc.property(validGoal, validGoal, (home, away) => {
        expect(validateGoals(home, away)).toEqual({ valid: true });
      }),
      { numRuns: NUM_RUNS }
    );
  });

  it("rejette avec GOALS_INVALID dès qu'un côté est invalide", () => {
    // position : 0 = domicile invalide, 1 = extérieur invalide.
    fc.assert(
      fc.property(
        validGoal,
        invalidGoal,
        fc.integer({ min: 0, max: 1 }),
        (good, bad, position) => {
          const home = position === 0 ? bad : good;
          const away = position === 0 ? good : bad;
          const result = validateGoals(home, away);
          expect(result.valid).toBe(false);
          if (!result.valid) {
            expect(result.errorKey).toBe("GOALS_INVALID");
          }
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  it("rejette avec GOALS_INVALID lorsque les deux côtés sont invalides", () => {
    fc.assert(
      fc.property(invalidGoal, invalidGoal, (home, away) => {
        const result = validateGoals(home, away);
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.errorKey).toBe("GOALS_INVALID");
        }
      }),
      { numRuns: NUM_RUNS }
    );
  });
});
