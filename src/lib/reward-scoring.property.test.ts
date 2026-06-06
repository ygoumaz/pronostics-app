import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  scoreRewardPrediction,
  REWARD_CORRECT_POINTS,
  REWARD_INCORRECT_POINTS,
} from "./reward-scoring";

// Feature: pronostics-coupe-du-monde, Property 17: Reward prediction scoring

/**
 * Ensemble d'identifiants de joueurs réalistes. Utilisé en plus de
 * `fc.string()` pour garantir des collisions (mêmes identifiants) et exercer
 * efficacement le cas « pronostic correct ».
 */
const realisticPlayerId = () =>
  fc.constantFrom(
    "player-1",
    "player-2",
    "player-42",
    "mbappe",
    "messi",
    "ronaldo",
    "haaland",
    "bellingham"
  );

/** Générateur d'identifiant de joueur : chaînes arbitraires ou ids réalistes. */
const playerId = () => fc.oneof(fc.string(), realisticPlayerId());

describe("Property 17: Reward prediction scoring", () => {
  // Validates: Requirements 18.9, 18.10

  it("attribue exactement 5 points bonus quand le pronostic correspond au vainqueur", () => {
    fc.assert(
      fc.property(playerId(), (p) => {
        // Pronostic identique au vainqueur officiel (18.9).
        expect(scoreRewardPrediction(p, p)).toBe(REWARD_CORRECT_POINTS);
        expect(scoreRewardPrediction(p, p)).toBe(5);
      }),
      { numRuns: 100 }
    );
  });

  it("attribue exactement 0 point bonus quand le pronostic diffère du vainqueur", () => {
    fc.assert(
      fc.property(playerId(), playerId(), (a, b) => {
        // On ne considère que les identifiants distincts (18.10).
        fc.pre(a !== b);
        expect(scoreRewardPrediction(a, b)).toBe(REWARD_INCORRECT_POINTS);
        expect(scoreRewardPrediction(a, b)).toBe(0);
      }),
      { numRuns: 100 }
    );
  });

  it("retourne toujours exactement 5 ou 0 pour une paire arbitraire d'identifiants", () => {
    fc.assert(
      fc.property(playerId(), playerId(), (a, b) => {
        const points = scoreRewardPrediction(a, b);
        // Le résultat appartient strictement au barème {0, 5} (18.9 / 18.10).
        expect([REWARD_INCORRECT_POINTS, REWARD_CORRECT_POINTS]).toContain(
          points
        );
        // Et il est cohérent avec la comparaison stricte des identifiants.
        expect(points).toBe(a === b ? 5 : 0);
      }),
      { numRuns: 100 }
    );
  });
});
