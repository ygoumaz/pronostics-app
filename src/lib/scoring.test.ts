import { describe, it, expect } from "vitest";
import { calculatePoints } from "./scoring";

/**
 * Tests unitaires du barème de scoring avec des exemples concrets.
 *
 * Convention : dans chaque cas, le PREMIER score est le pronostic du
 * participant, le SECOND est le résultat officiel.
 *
 * Barème (Exigence 8) :
 * - +1 si bonne issue (correctOutcome) — Exigence 8.2
 * - +1 si bonne différence de buts (correctDifference) — Exigence 8.3
 * - +1 si score exact (exactScore) — Exigence 8.4
 * - total dans [0, 3] — Exigence 8.5
 */
describe("calculatePoints — exemples concrets du barème", () => {
  // Validates: Requirements 8.2, 8.3, 8.4, 8.5
  it("2-1 vs 2-1 → score exact → 3 pts", () => {
    const scoring = calculatePoints(
      { homeGoals: 2, awayGoals: 1 },
      { homeGoals: 2, awayGoals: 1 }
    );
    expect(scoring.correctOutcome).toBe(true);
    expect(scoring.correctDifference).toBe(true);
    expect(scoring.exactScore).toBe(true);
    expect(scoring.totalPoints).toBe(3);
  });

  // Validates: Requirements 8.2, 8.3, 8.5
  it("2-1 vs 3-2 → bonne issue + bonne différence → 2 pts", () => {
    const scoring = calculatePoints(
      { homeGoals: 2, awayGoals: 1 },
      { homeGoals: 3, awayGoals: 2 }
    );
    expect(scoring.correctOutcome).toBe(true);
    expect(scoring.correctDifference).toBe(true);
    expect(scoring.exactScore).toBe(false);
    expect(scoring.totalPoints).toBe(2);
  });

  // Validates: Requirements 8.2, 8.3, 8.5
  it("2-1 vs 1-0 → bonne issue + bonne différence → 2 pts", () => {
    const scoring = calculatePoints(
      { homeGoals: 2, awayGoals: 1 },
      { homeGoals: 1, awayGoals: 0 }
    );
    expect(scoring.correctOutcome).toBe(true);
    expect(scoring.correctDifference).toBe(true);
    expect(scoring.exactScore).toBe(false);
    expect(scoring.totalPoints).toBe(2);
  });

  // Validates: Requirements 8.2, 8.3, 8.5
  it("2-1 vs 3-0 → bonne issue seule (différence 1 vs 3) → 1 pt", () => {
    const scoring = calculatePoints(
      { homeGoals: 2, awayGoals: 1 },
      { homeGoals: 3, awayGoals: 0 }
    );
    expect(scoring.correctOutcome).toBe(true);
    expect(scoring.correctDifference).toBe(false);
    expect(scoring.exactScore).toBe(false);
    expect(scoring.totalPoints).toBe(1);
  });

  // Validates: Requirements 8.2, 8.5
  it("2-1 vs 0-0 → mauvaise issue (victoire vs nul) → 0 pt", () => {
    const scoring = calculatePoints(
      { homeGoals: 2, awayGoals: 1 },
      { homeGoals: 0, awayGoals: 0 }
    );
    expect(scoring.correctOutcome).toBe(false);
    expect(scoring.correctDifference).toBe(false);
    expect(scoring.exactScore).toBe(false);
    expect(scoring.totalPoints).toBe(0);
  });
});

describe("calculatePoints — cas des tirs au but (TAB)", () => {
  /**
   * Exigence 8.9/8.10 : un match éliminatoire terminé aux tirs au but est
   * enregistré comme un nul (le vainqueur aux TAB n'entre pas dans le calcul
   * du barème). Un pronostic prédisant un nul a donc la bonne issue.
   */

  // Validates: Requirements 8.2, 8.3, 8.5, 8.10
  it("pronostic 1-1 vs résultat 2-2 (TAB) → nul correct + différence (0) → 2 pts", () => {
    const scoring = calculatePoints(
      { homeGoals: 1, awayGoals: 1 },
      { homeGoals: 2, awayGoals: 2 }
    );
    expect(scoring.correctOutcome).toBe(true);
    expect(scoring.correctDifference).toBe(true);
    expect(scoring.exactScore).toBe(false);
    expect(scoring.totalPoints).toBe(2);
  });

  // Validates: Requirements 8.2, 8.3, 8.5, 8.10
  //
  // NOTE / DIVERGENCE AVEC L'ÉNONCÉ DE LA TÂCHE :
  // La tâche annonçait "1-1 (TAB) vs 0-0 → 1 pt". Cette valeur est incohérente
  // avec le barème (Exigence 8). Pour deux scores nuls, l'issue est identique
  // (DRAW == DRAW → correctOutcome) ET la différence de buts est identique
  // (0 == 0 → correctDifference). Le total correct est donc 2 pts, pas 1.
  // Le test asserte la valeur réelle du barème (2 pts).
  it("pronostic 1-1 vs résultat 0-0 (TAB) → nul correct + différence (0) → 2 pts", () => {
    const scoring = calculatePoints(
      { homeGoals: 1, awayGoals: 1 },
      { homeGoals: 0, awayGoals: 0 }
    );
    expect(scoring.correctOutcome).toBe(true);
    expect(scoring.correctDifference).toBe(true);
    expect(scoring.exactScore).toBe(false);
    expect(scoring.totalPoints).toBe(2);
  });
});
