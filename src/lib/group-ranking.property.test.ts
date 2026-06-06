import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { calculateGroupStandings } from "./group-ranking";
import type { GroupMatchResult, GroupStanding } from "@/types";

// Feature: pronostics-coupe-du-monde, Property 4: Group standings tiebreaker correctness

/**
 * Quatre équipes distinctes aux noms réels pour exercer le départage final
 * alphabétique (critère 7).
 */
const TEAMS = ["Alpha", "Bravo", "Charlie", "Delta"] as const;

/**
 * Les 6 confrontations du round-robin (toutes les paires non ordonnées des 4
 * équipes). Chaque équipe joue donc exactement 3 matchs.
 */
const PAIRS: ReadonlyArray<readonly [string, string]> = [
  [TEAMS[0], TEAMS[1]],
  [TEAMS[0], TEAMS[2]],
  [TEAMS[0], TEAMS[3]],
  [TEAMS[1], TEAMS[2]],
  [TEAMS[1], TEAMS[3]],
  [TEAMS[2], TEAMS[3]],
];

/** Générateur d'un score d'équipe sur un match, dans [0, 5]. */
const goal = () => fc.integer({ min: 0, max: 5 });

/**
 * Génère les 6 résultats de matchs du groupe. L'orientation home/away est
 * également tirée au sort pour ne pas figer l'avantage du terrain.
 */
const matchesArb = (): fc.Arbitrary<GroupMatchResult[]> =>
  fc
    .tuple(
      ...PAIRS.map(([t1, t2]) =>
        fc.record({
          swap: fc.boolean(),
          a: goal(),
          b: goal(),
        }).map(({ swap, a, b }) => ({
          homeTeam: swap ? t2 : t1,
          awayTeam: swap ? t1 : t2,
          homeGoals: swap ? b : a,
          awayGoals: swap ? a : b,
        }))
      )
    )
    .map((arr) => arr as GroupMatchResult[]);

// === Re-dérivation indépendante de l'algorithme documenté ===

interface DerivedStats {
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

/**
 * Agrège indépendamment les statistiques d'équipe à partir d'un ensemble de
 * matchs (3 points victoire, 1 nul, 0 défaite). Réimplémenté ici sans réutiliser
 * l'implémentation sous test.
 */
function deriveStats(matches: GroupMatchResult[], teams: string[]): Map<string, DerivedStats> {
  const map = new Map<string, DerivedStats>();
  for (const team of teams) {
    map.set(team, {
      team,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
    });
  }
  for (const m of matches) {
    const home = map.get(m.homeTeam)!;
    const away = map.get(m.awayTeam)!;
    home.played++;
    away.played++;
    home.goalsFor += m.homeGoals;
    home.goalsAgainst += m.awayGoals;
    away.goalsFor += m.awayGoals;
    away.goalsAgainst += m.homeGoals;
    if (m.homeGoals > m.awayGoals) {
      home.won++;
      away.lost++;
      home.points += 3;
    } else if (m.homeGoals < m.awayGoals) {
      away.won++;
      home.lost++;
      away.points += 3;
    } else {
      home.drawn++;
      away.drawn++;
      home.points += 1;
      away.points += 1;
    }
  }
  for (const s of Array.from(map.values())) {
    s.goalDifference = s.goalsFor - s.goalsAgainst;
  }
  return map;
}

/**
 * Comparateur des critères généraux (points, diff. de buts, buts marqués,
 * tous décroissants). Négatif si `a` devant `b`.
 */
function compareOverall(a: DerivedStats, b: DerivedStats): number {
  if (a.points !== b.points) return b.points - a.points;
  if (a.goalDifference !== b.goalDifference) return b.goalDifference - a.goalDifference;
  if (a.goalsFor !== b.goalsFor) return b.goalsFor - a.goalsFor;
  return 0;
}

/**
 * Calcule l'ordre attendu des équipes en réimplémentant l'algorithme documenté :
 * tri général, regroupement des égalités parfaites, départage par confrontation
 * directe (mini-classement entre équipes à égalité) puis ordre alphabétique.
 */
function expectedOrder(matches: GroupMatchResult[], teams: string[]): string[] {
  const stats = deriveStats(matches, teams);
  const sorted = [...teams].sort((x, y) => compareOverall(stats.get(x)!, stats.get(y)!));

  const result: string[] = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i + 1;
    while (j < sorted.length && compareOverall(stats.get(sorted[i])!, stats.get(sorted[j])!) === 0) {
      j++;
    }
    const tied = sorted.slice(i, j);
    if (tied.length === 1) {
      result.push(tied[0]);
    } else {
      const tiedSet = new Set(tied);
      const h2hMatches = matches.filter((m) => tiedSet.has(m.homeTeam) && tiedSet.has(m.awayTeam));
      const h2hStats = deriveStats(h2hMatches, tied);
      const ordered = [...tied].sort((x, y) => {
        const byH2h = compareOverall(h2hStats.get(x)!, h2hStats.get(y)!);
        if (byH2h !== 0) return byH2h;
        return x.localeCompare(y);
      });
      result.push(...ordered);
    }
    i = j;
  }
  return result;
}

describe("Property 4: Group standings tiebreaker correctness", () => {
  // Validates: Requirements 3.3, 3.11
  it("produit des positions 1..4 sans trou, des stats correctes et l'ordre de départage attendu", () => {
    fc.assert(
      fc.property(matchesArb(), (matches) => {
        const standings = calculateGroupStandings("A", matches);
        const teams = [...TEAMS];

        // (a) Exactement 4 entrées, positions [1,2,3,4] sans trou ni doublon.
        expect(standings).toHaveLength(4);
        const positions = standings.map((s) => s.position);
        expect(positions).toEqual([1, 2, 3, 4]);
        const teamSet = new Set(standings.map((s) => s.team));
        expect(teamSet).toEqual(new Set(teams));

        // (b) Statistiques correctes pour chaque équipe (re-dérivées indépendamment).
        const expectedStats = deriveStats(matches, teams);
        const byTeam = new Map<string, GroupStanding>(standings.map((s) => [s.team, s]));
        for (const team of teams) {
          const exp = expectedStats.get(team)!;
          const act = byTeam.get(team)!;
          expect(act.played).toBe(3); // round-robin complet : 3 matchs chacun
          expect(act.played).toBe(exp.played);
          expect(act.won).toBe(exp.won);
          expect(act.drawn).toBe(exp.drawn);
          expect(act.lost).toBe(exp.lost);
          expect(act.goalsFor).toBe(exp.goalsFor);
          expect(act.goalsAgainst).toBe(exp.goalsAgainst);
          expect(act.goalDifference).toBe(exp.goalDifference);
          expect(act.points).toBe(exp.points);
          // Cohérence interne du barème.
          expect(act.points).toBe(act.won * 3 + act.drawn);
          expect(act.goalDifference).toBe(act.goalsFor - act.goalsAgainst);
        }

        // (c) Ordre de classement conforme au comparateur documenté.
        const actualOrder = standings.map((s) => s.team);
        const expected = expectedOrder(matches, teams);
        expect(actualOrder).toEqual(expected);

        // (d) Monotonie sur les critères généraux pour les paires NON à égalité
        //     parfaite (points, GD, GF) : l'équipe précédente n'est jamais
        //     strictement moins bien classée.
        for (let k = 0; k < standings.length - 1; k++) {
          const a = standings[k];
          const b = standings[k + 1];
          const aOverall: [number, number, number] = [a.points, a.goalDifference, a.goalsFor];
          const bOverall: [number, number, number] = [b.points, b.goalDifference, b.goalsFor];
          const tiedOnOverall =
            aOverall[0] === bOverall[0] && aOverall[1] === bOverall[1] && aOverall[2] === bOverall[2];
          if (!tiedOnOverall) {
            // a doit dominer b sur l'ordre lexicographique (points, GD, GF).
            const aBeatsB =
              aOverall[0] > bOverall[0] ||
              (aOverall[0] === bOverall[0] && aOverall[1] > bOverall[1]) ||
              (aOverall[0] === bOverall[0] && aOverall[1] === bOverall[1] && aOverall[2] > bOverall[2]);
            expect(aBeatsB).toBe(true);
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});
