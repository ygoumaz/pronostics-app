import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { calculateRanking } from "./ranking";
import type { Participant, Pronostic, RewardPrediction } from "@/types";

// Feature: pronostics-coupe-du-monde, Property 9: Ranking calculation

/**
 * Property 9: Ranking calculation
 * Validates: Requirements 9.1, 9.2, 9.4, 18.11
 *
 * Pour tout ensemble de participants avec pronostics évalués et prédictions de
 * récompenses, le classement DOIT :
 *  - calculer le score total de chaque participant = somme des points de tous
 *    ses matchs (0-3 chacun) + somme des bonus de récompenses (0 ou 5 chacun),
 *    un `points` absent étant compté comme 0 ;
 *  - trier par score total décroissant ;
 *  - attribuer rang = 1 + nombre de participants au score strictement supérieur
 *    (les ex-aequo partagent le même rang) ;
 *  - départager les ex-aequo par nom d'affichage alphabétique croissant.
 */

const DATE = new Date("2026-06-01T00:00:00.000Z");

// Petit alphabet de noms pour forcer des collisions de noms et faciliter les
// scénarios d'égalité de score.
const displayNameArb = fc.constantFrom("Alice", "alice", "Bob", "bob", "Zoé", "Émile");

// Points de match dans {0,1,2,3} ; `undefined` autorisé (traité comme 0).
const matchPointsArb = fc.option(fc.integer({ min: 0, max: 3 }), {
  nil: undefined,
  freq: 4,
});

// Points de récompense dans {0,5} ; `undefined` autorisé (traité comme 0).
const rewardPointsArb = fc.option(fc.constantFrom(0, 5), {
  nil: undefined,
  freq: 4,
});

interface Scenario {
  participants: Participant[];
  pronostics: Pronostic[];
  rewardPredictions: RewardPrediction[];
}

/**
 * Génère un ensemble cohérent de participants (ids distincts), de pronostics et
 * de prédictions de récompenses tous rattachés à des participants existants.
 */
const scenarioArb: fc.Arbitrary<Scenario> = fc
  .integer({ min: 1, max: 8 })
  .chain((n) => {
    const participantArb = fc.record({
      displayName: displayNameArb,
      // Plusieurs pronostics par participant, certains sans points.
      matchPoints: fc.array(matchPointsArb, { maxLength: 6 }),
      // Plusieurs prédictions de récompenses, certaines sans points.
      rewardPoints: fc.array(rewardPointsArb, { maxLength: 5 }),
    });

    return fc.array(participantArb, { minLength: n, maxLength: n }).map((raw) => {
      const participants: Participant[] = [];
      const pronostics: Pronostic[] = [];
      const rewardPredictions: RewardPrediction[] = [];

      raw.forEach((r, i) => {
        const id = `p${i}`;
        participants.push({
          id,
          email: `${id}@example.com`,
          displayName: r.displayName,
          passwordHash: "hash",
          isAdmin: false,
          createdAt: DATE,
        });

        r.matchPoints.forEach((pts, j) => {
          pronostics.push({
            id: `${id}-pr${j}`,
            participantId: id,
            matchId: `m${j}`,
            homeGoals: 0,
            awayGoals: 0,
            points: pts,
            createdAt: DATE,
            updatedAt: DATE,
          });
        });

        r.rewardPoints.forEach((pts, j) => {
          rewardPredictions.push({
            id: `${id}-rw${j}`,
            participantId: id,
            rewardType: "GOLDEN_BOOT",
            playerId: `player${j}`,
            points: pts,
            createdAt: DATE,
            updatedAt: DATE,
          });
        });
      });

      return { participants, pronostics, rewardPredictions };
    });
  });

/** Somme indépendante des points (undefined -> 0) pour un participant donné. */
function expectedTotal(
  participantId: string,
  pronostics: Pronostic[],
  rewardPredictions: RewardPrediction[]
): number {
  let total = 0;
  for (const p of pronostics) {
    if (p.participantId === participantId) total += p.points ?? 0;
  }
  for (const r of rewardPredictions) {
    if (r.participantId === participantId) total += r.points ?? 0;
  }
  return total;
}

describe("Property 9: Ranking calculation", () => {
  // Validates: Requirements 9.1, 9.2, 9.4, 18.11
  it("calcule le score, l'ordre et les rangs du classement global pour tout ensemble de participants", () => {
    fc.assert(
      fc.property(scenarioArb, ({ participants, pronostics, rewardPredictions }) => {
        const ranking = calculateRanking(participants, pronostics, rewardPredictions);

        // (4) Chaque participant apparaît exactement une fois.
        expect(ranking).toHaveLength(participants.length);
        const idsInOutput = ranking.map((e) => e.participantId).sort();
        const expectedIds = participants.map((p) => p.id).sort();
        expect(idsInOutput).toEqual(expectedIds);

        // (1) totalPoints = somme re-dérivée indépendamment.
        for (const entry of ranking) {
          expect(entry.totalPoints).toBe(
            expectedTotal(entry.participantId, pronostics, rewardPredictions)
          );
        }

        // (2) Tri par totalPoints décroissant, ties par displayName croissant.
        for (let i = 1; i < ranking.length; i++) {
          const prev = ranking[i - 1];
          const cur = ranking[i];
          if (prev.totalPoints === cur.totalPoints) {
            expect(
              prev.displayName.localeCompare(cur.displayName)
            ).toBeLessThanOrEqual(0);
          } else {
            expect(prev.totalPoints).toBeGreaterThan(cur.totalPoints);
          }
        }

        // (3) rang = 1 + nombre de participants au score strictement supérieur.
        for (const entry of ranking) {
          const strictlyHigher = ranking.filter(
            (e) => e.totalPoints > entry.totalPoints
          ).length;
          expect(entry.rank).toBe(1 + strictlyHigher);
        }

        // (3 bis) Ex-aequo => même rang ; scores différents => rangs différents.
        for (const a of ranking) {
          for (const b of ranking) {
            if (a.totalPoints === b.totalPoints) {
              expect(a.rank).toBe(b.rank);
            } else {
              expect(a.rank).not.toBe(b.rank);
            }
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});
